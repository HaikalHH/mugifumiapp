"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth, hasAccess } from "../providers";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

type UserRow = { id: number; username: string; name: string; role: string; createdAt: string; baseSalary?: number; workStartMinutes?: number; workEndMinutes?: number };

const ROLES = ["Admin", "Manager", "Sales", "Bandung", "Jakarta", "Baker", "BDGSales"] as const;

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({ name: "", username: "", role: "Sales" as typeof ROLES[number] });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [manage, setManage] = useState<{ open: boolean; user: (UserRow & { baseSalary?: number; workStartMinutes?: number; workEndMinutes?: number; overtimeHourlyRate?: number }) | null }>({ open: false, user: null });

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!hasAccess(user, "users")) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!form.name.trim() || !form.username.trim()) {
      setError("Nama dan Username wajib diisi");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), username: form.username.trim(), role: form.role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal membuat user");
        return;
      }
      setForm({ name: "", username: "", role: "Sales" });
      setMessage("User berhasil dibuat. Password default: Otsuka2026");
      load();
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Users</h1>
      <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Nama</Label>
          <Input placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Username</Label>
          <Input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as any })}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Menyimpan..." : "Tambah User"}</Button>
        </div>
      </form>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {message && <div className="text-sm text-green-600">{message}</div>}

      <div>
        <h2 className="font-medium mb-2">Daftar User</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Username</TableHead>
              <TableHead className="text-left">Nama</TableHead>
              <TableHead className="text-left">Role</TableHead>
              <TableHead className="text-right">Gaji Pokok (Rp)</TableHead>
              <TableHead className="text-center">Manage</TableHead>
              <TableHead className="text-left">Jam (Masuk - Keluar)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono">{u.username}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell className="text-right">Rp {(u.baseSalary || 0).toLocaleString('id-ID')}</TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="link"
                    className="p-0 h-auto"
                    onClick={async () => {
                      const details = await fetch(`/api/users/${u.id}`).then((r) => r.json()).catch(() => ({}));
                      setManage({ open: true, user: { ...u, ...details } });
                    }}
                  >
                    Manage
                  </Button>
                </TableCell>
                <TableCell>
                  {(() => {
                    const s = typeof u.workStartMinutes === 'number' ? u.workStartMinutes : 540;
                    const e = typeof u.workEndMinutes === 'number' ? u.workEndMinutes : 1020;
                    const fmt = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
                    return `${fmt(s)} - ${fmt(e)}`;
                  })()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Manage dialog */}
      {manage.open && manage.user && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md w-full max-w-xl p-6 space-y-4">
            <div className="text-lg font-semibold">Manage User - {manage.user.name}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label>Gaji Pokok (Rp)</Label>
                <Input
                  type="number"
                  value={(manage.user as any).baseSalary ?? 0}
                  onChange={(e) => setManage((prev) => prev.user ? { ...prev, user: { ...prev.user, baseSalary: Number(e.target.value) } } : prev)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Jam Mulai</Label>
                <div className="flex gap-2">
                  <Select
                    value={(() => String(Math.floor(((manage.user as any).workStartMinutes ?? 540)/60)).padStart(2,'0'))()}
                    onValueChange={(hh) => {
                      const mm = String((((manage.user as any).workStartMinutes ?? 540) % 60)).padStart(2,'0');
                      const minutes = Number(hh) * 60 + Number(mm);
                      setManage((prev) => prev.user ? { ...prev, user: { ...prev.user, workStartMinutes: minutes } } : prev);
                    }}
                  >
                    <SelectTrigger className="w-[84px]"><SelectValue placeholder="HH" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }).map((_, h) => (
                        <SelectItem key={h} value={String(h).padStart(2,'0')}>{String(h).padStart(2,'0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={(() => String((((manage.user as any).workStartMinutes ?? 540) % 60)).padStart(2,'0'))()}
                    onValueChange={(mm) => {
                      const hh = Math.floor(((manage.user as any).workStartMinutes ?? 540)/60);
                      const minutes = hh * 60 + Number(mm);
                      setManage((prev) => prev.user ? { ...prev, user: { ...prev.user, workStartMinutes: minutes } } : prev);
                    }}
                  >
                    <SelectTrigger className="w-[84px]"><SelectValue placeholder="MM" /></SelectTrigger>
                    <SelectContent>
                      {["00","15","30","45"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Jam Selesai</Label>
                <div className="flex gap-2">
                  <Select
                    value={(() => String(Math.floor(((manage.user as any).workEndMinutes ?? 1020)/60)).padStart(2,'0'))()}
                    onValueChange={(hh) => {
                      const mm = String((((manage.user as any).workEndMinutes ?? 1020) % 60)).padStart(2,'0');
                      const minutes = Number(hh) * 60 + Number(mm);
                      setManage((prev) => prev.user ? { ...prev, user: { ...prev.user, workEndMinutes: minutes } } : prev);
                    }}
                  >
                    <SelectTrigger className="w-[84px]"><SelectValue placeholder="HH" /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }).map((_, h) => (
                        <SelectItem key={h} value={String(h).padStart(2,'0')}>{String(h).padStart(2,'0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={(() => String((((manage.user as any).workEndMinutes ?? 1020) % 60)).padStart(2,'0'))()}
                    onValueChange={(mm) => {
                      const hh = Math.floor(((manage.user as any).workEndMinutes ?? 1020)/60);
                      const minutes = hh * 60 + Number(mm);
                      setManage((prev) => prev.user ? { ...prev, user: { ...prev.user, workEndMinutes: minutes } } : prev);
                    }}
                  >
                    <SelectTrigger className="w-[84px]"><SelectValue placeholder="MM" /></SelectTrigger>
                    <SelectContent>
                      {["00","15","30","45"].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Rate Lembur / Jam (Rp)</Label>
                <Input
                  type="number"
                  value={(manage.user as any).overtimeHourlyRate ?? ''}
                  onChange={(e) => setManage((prev) => prev.user ? { ...prev, user: { ...prev.user, overtimeHourlyRate: e.target.value === '' ? undefined : Number(e.target.value) } } : prev)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setManage({ open: false, user: null })}
              >
                Close
              </Button>
              <Button
                onClick={async () => {
                  const payload: any = {
                    baseSalary: (manage.user as any).baseSalary ?? 0,
                    workStartMinutes: (manage.user as any).workStartMinutes ?? 540,
                    workEndMinutes: (manage.user as any).workEndMinutes ?? 1020,
                    overtimeHourlyRate: (manage.user as any).overtimeHourlyRate ?? null,
                  };
                  await fetch(`/api/users/${manage.user!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                  setManage({ open: false, user: null });
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
