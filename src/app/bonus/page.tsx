"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../providers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";

type UserRow = { id: number; name: string; username: string; role: string };
type BonusRow = { id: number; userId: number; year: number; month: number; amount: number; note?: string; user: UserRow };

export default function BonusPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selUserId, setSelUserId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => Array.from({ length: 5 }).map((_, i) => String(new Date().getFullYear() - i)), []);
  const months = useMemo(() => Array.from({ length: 12 }).map((_, i) => String(i + 1)), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ year, month }).toString();
      const [bon, usr] = await Promise.all([
        fetch(`/api/bonus?${qs}`).then((r) => r.json()),
        fetch(`/api/users`).then((r) => r.json()).catch(() => ({ users: [] })),
      ]);
      setRows(Array.isArray(bon.rows) ? bon.rows : []);
      setUsers(Array.isArray(usr.users) ? usr.users : []);
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { if (user?.role === "Admin") load(); }, [user, load]);

  if (user?.role !== "Admin") {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  const onAdd = async () => {
    if (!selUserId || !amount) {
      alert("Pilih user dan isi nominal");
      return;
    }
    const payload = { userId: Number(selUserId), year: Number(year), month: Number(month), amount: Math.round(Number(amount)), note };
    const res = await fetch('/api/bonus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { alert('Gagal menambah bonus'); return; }
    setAmount(""); setNote("");
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm('Hapus bonus ini?')) return;
    const res = await fetch(`/api/bonus/${id}`, { method: 'DELETE' });
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
        <div className="font-medium">Tambah Bonus</div>
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
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" />
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
              <TableHead>Catatan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.user?.name}</TableCell>
                <TableCell>{String(r.month).padStart(2,'0')}/{r.year}</TableCell>
                <TableCell className="text-right">Rp {Number(r.amount || 0).toLocaleString('id-ID')}</TableCell>
                <TableCell>{r.note || '-'}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => remove(r.id)}>Hapus</Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-gray-600">Belum ada bonus</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </main>
  );
}
