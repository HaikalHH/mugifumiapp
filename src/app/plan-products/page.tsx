"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { hasRole, useAuth } from "../providers";

type PlanProduct = { id: number; name: string; createdAt: string; updatedAt: string };

export default function PlanProductsPage() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, "Admin");
  const [items, setItems] = useState<PlanProduct[]>([]);
  const [formName, setFormName] = useState("");
  const [editing, setEditing] = useState<PlanProduct | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/plan-products");
    if (res.ok) {
      setItems(await res.json());
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    const res = await fetch("/api/plan-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName.trim() }),
    });
    if (res.ok) {
      setFormName("");
      load();
    }
  };

  const startEdit = (row: PlanProduct) => {
    setEditing(row);
    setEditName(row.name);
  };

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    const res = await fetch(`/api/plan-products/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      setEditing(null);
      setEditName("");
      load();
    }
  };

  const remove = async (row: PlanProduct) => {
    if (!confirm(`Hapus ${row.name}?`)) return;
    const res = await fetch(`/api/plan-products/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({ error: "Gagal menghapus" }));
      alert(msg.error || "Gagal menghapus");
      return;
    }
    load();
  };

  if (!isAdmin) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products Plan</h1>
        <p className="text-sm text-gray-600">Master data nama produk khusus perencanaan produksi.</p>
      </div>

      <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-4 flex flex-col gap-1">
          <Label>Nama Produk</Label>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Contoh: Hokkaido Large" required />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">Tambah</Button>
        </div>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Nama</TableHead>
            <TableHead className="text-left">Dibuat</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{new Date(row.createdAt).toLocaleString("id-ID")}</TableCell>
              <TableCell className="text-center">
                <div className="flex justify-center gap-2">
                  <Button variant="link" className="p-0 h-auto" onClick={() => startEdit(row)}>Edit</Button>
                  <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => remove(row)}>Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-gray-500">Belum ada data.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) { setEditing(null); setEditName(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Plan Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={update} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label>Nama</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setEditing(null); setEditName(""); }}>Cancel</Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
