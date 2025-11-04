"use client";
import { useCallback, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

type Ingredient = { id: number; code: string; name: string; unit: string };

export default function IngredientsPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; unit: string }>({ name: "", unit: "gram" });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; unit: string }>({ name: "", unit: "gram" });

  const load = useCallback(async () => {
    const res = await fetch('/api/ingredients');
    setItems(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) {
      setForm({ name: "", unit: "gram" });
      setOpen(false);
      load();
    }
  };

  const startEdit = (it: Ingredient) => {
    setEditing(it);
    setEditForm({ name: it.name, unit: it.unit });
    setEditOpen(true);
  };

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const res = await fetch(`/api/ingredients/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
    if (res.ok) {
      setEditOpen(false);
      setEditing(null);
      load();
    }
  };

  const remove = async (it: Ingredient) => {
    if (!confirm(`Hapus bahan ${it.name} (${it.code})?`)) return;
    const res = await fetch(`/api/ingredients/${it.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Gagal menghapus. Pastikan tidak dipakai di recipe.');
      return;
    }
    load();
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bahan (Ingredients)</h2>
        <Button onClick={() => setOpen(true)}>Add Bahan</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Code</TableHead>
            <TableHead className="text-left">Name</TableHead>
            <TableHead className="text-left">Unit</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow key={it.id}>
              <TableCell>{it.code}</TableCell>
              <TableCell>{it.name}</TableCell>
              <TableCell>{it.unit}</TableCell>
              <TableCell className="text-center">
                <div className="flex gap-2 justify-center">
                  <Button variant="link" className="p-0 h-auto" onClick={() => startEdit(it)}>Edit</Button>
                  <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => remove(it)}>Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-gray-500">Belum ada data bahan.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bahan</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tepung Terigu" required />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gram">gram</SelectItem>
                  <SelectItem value="liter">liter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bahan</DialogTitle>
          </DialogHeader>
          <form onSubmit={update} className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label>Code</Label>
              <Input value={editing?.code || ''} disabled className="bg-gray-100" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Unit</Label>
              <Select value={editForm.unit} onValueChange={(v) => setEditForm({ ...editForm, unit: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gram">gram</SelectItem>
                  <SelectItem value="liter">liter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
