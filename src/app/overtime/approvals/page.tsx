"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../providers";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

export default function OvertimeApprovalsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [userMap, setUserMap] = useState<Record<number, { name: string }>>({});

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ month, all: "true" });
    const res = await fetch(`/api/overtime?${qs.toString()}`);
    const data = await res.json();
    setItems(data.items || []);
    const users = await fetch('/api/users').then(r => r.json()).catch(() => ({ users: [] }));
    const map: Record<number, { name: string }> = {};
    (users.users || []).forEach((u: any) => { map[u.id] = { name: u.name || u.username }; });
    setUserMap(map);
  }, [month]);
  useEffect(() => { load(); }, [load]);

  if (!user || user.role !== "Admin") {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  const handle = async (id: number, approve: boolean) => {
    await fetch(`/api/overtime/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve, adminId: user.id }) });
    load();
  };

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Overtime Approvals</h1>
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label>Bulan</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }).map((_, idx) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - idx);
                  const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  return <SelectItem key={m} value={m}>{m}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Mulai (Jakarta)</TableHead>
              <TableHead>Selesai (Jakarta)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
              <TableCell>{userMap[it.userId]?.name || it.userId}</TableCell>
              <TableCell>{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(it.startAt))}</TableCell>
              <TableCell>{new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(it.endAt))}</TableCell>
              <TableCell>{it.status}</TableCell>
              <TableCell className="text-center">
                {it.status === "PENDING" ? (
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => handle(it.id, true)}>Approve</Button>
                    <Button variant="outline" onClick={() => handle(it.id, false)}>Reject</Button>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">Done</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
