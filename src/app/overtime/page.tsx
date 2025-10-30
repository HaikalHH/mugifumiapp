"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth, hasAccess } from "../providers";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

export default function OvertimePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ date: "", sh: "", sm: "00", eh: "", em: "00" });
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;
    const d = new Date();
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const qs = new URLSearchParams({ userId: String(user.id), month: monthStr });
    const res = await fetch(`/api/overtime?${qs.toString()}`);
    const data = await res.json();
    setItems(data.items || []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!hasAccess(user, "overtime")) {
    return (
      <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (!user) return;
    if (!form.date || form.sh === "" || form.eh === "") { setMsg("Isi tanggal, jam mulai, jam selesai"); return; }
    // Treat inputs as Jakarta local then convert to ISO with +07:00 offset
    const startAt = `${form.date}T${form.sh}:${form.sm}:00+07:00`;
    const endAt = `${form.date}T${form.eh}:${form.em}:00+07:00`;
    const res = await fetch("/api/overtime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, startAt, endAt }) });
    const data = await res.json();
    if (res.ok) {
      setForm({ date: "", sh: "", sm: "00", eh: "", em: "00" });
      setMsg("Lembur diajukan");
      load();
      setTimeout(() => setMsg(""), 2500);
    } else {
      setMsg(data.error || "Gagal mengajukan lembur");
    }
  };

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Overtime</h1>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Tanggal (Jakarta)</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Mulai (Jakarta) - Jam</Label>
          <Select value={form.sh} onValueChange={(v) => setForm({ ...form, sh: v })}>
            <SelectTrigger>
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }).map((_, h) => (
                <SelectItem key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Mulai (Jakarta) - Menit</Label>
          <Select value={form.sm} onValueChange={(v) => setForm({ ...form, sm: v })}>
            <SelectTrigger>
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {["00","15","30","45"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Selesai (Jakarta) - Jam</Label>
          <Select value={form.eh} onValueChange={(v) => setForm({ ...form, eh: v })}>
            <SelectTrigger>
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }).map((_, h) => (
                <SelectItem key={h} value={String(h).padStart(2, '0')}>{String(h).padStart(2, '0')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Selesai (Jakarta) - Menit</Label>
          <Select value={form.em} onValueChange={(v) => setForm({ ...form, em: v })}>
            <SelectTrigger>
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {["00","15","30","45"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex">
          <Button className="w-full" type="submit">Ajukan</Button>
        </div>
      </form>
      {msg && <div className="text-sm text-blue-600">{msg}</div>}

      <div>
        <h2 className="font-medium mb-2">Daftar Lembur</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mulai (Jakarta)</TableHead>
              <TableHead>Selesai (Jakarta)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(it.startAt))}</TableCell>
                <TableCell>{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(it.endAt))}</TableCell>
                <TableCell>{it.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
