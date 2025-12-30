"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, hasRole } from "../providers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

type UserRow = { id: number; name: string; username: string; role: string };
type PenaltyRow = { id: number; userId: number; year: number; month: number; amount: number; reason?: string | null; user: UserRow; createdAt: string };

export default function PenaltyPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PenaltyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selUserId, setSelUserId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => Array.from({ length: 5 }).map((_, i) => String(new Date().getFullYear() - i)), []);
  const months = useMemo(() => Array.from({ length: 12 }).map((_, i) => String(i + 1)), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ month: `${year}-${String(month).padStart(2, "0")}` }).toString();
      const [pen, usr] = await Promise.all([
        fetch(`/api/penalties?${qs}`).then((r) => r.json()),
        fetch(`/api/users`).then((r) => r.json()).catch(() => ({ users: [] })),
      ]);
      setRows(Array.isArray(pen) ? pen : []);
      setUsers(Array.isArray(usr.users) ? usr.users : Array.isArray(usr) ? usr : []);
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { if (hasRole(user, "Admin")) load(); }, [user, load]);

  if (!hasRole(user, "Admin")) {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  const onAdd = async () => {
    if (!selUserId || !amount) {
      alert("Pilih user dan isi nominal");
      return;
    }
    const payload = { userId: Number(selUserId), month: `${year}-${String(month).padStart(2, "0")}`, amount: Math.round(Number(amount)), reason };
    const res = await fetch('/api/penalties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { alert('Gagal menambah penalty'); return; }
    setAmount(""); setReason("");
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm('Hapus penalty ini?')) return;
    const res = await fetch(`/api/penalties/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Gagal menghapus'); return; }
    await load();
  };

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <div className="text-sm">Tahun</div>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-sm">Bulan</div>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => (<SelectItem key={m} value={m}>{m.padStart(2,'0')}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={load} disabled={loading}>Refresh</Button>
      </div>

      <section className="space-y-3">
        <div className="font-medium">Tambah Penalty</div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-sm">User</div>
            <Select value={selUserId} onValueChange={setSelUserId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Pilih user" /></SelectTrigger>
              <SelectContent>
                {users.map((u) => (<SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.username})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm">Nominal</div>
            <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Rp" />
          </div>
          <div>
            <div className="text-sm">Catatan</div>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Opsional" />
          </div>
          <Button onClick={onAdd}>Add</Button>
        </div>
      </section>

      <section>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Bulan</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Alasan</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.user?.name}</TableCell>
                <TableCell>{String(r.month).padStart(2,'0')}/{r.year}</TableCell>
                <TableCell className="text-right">Rp {Number(r.amount || 0).toLocaleString('id-ID')}</TableCell>
                <TableCell>{r.reason || '-'}</TableCell>
                <TableCell>{new Date(r.createdAt).toLocaleDateString("id-ID")}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => remove(r.id)}>Hapus</Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-gray-600">Belum ada penalty</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
