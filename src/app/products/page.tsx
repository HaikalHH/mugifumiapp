"use client";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useAuth } from "../providers";

type Product = {
  id: number;
  code: string;
  name: string;
  price: number;
  hppPct: number;
  hppValue: number;
};

export default function ProductsPage() {
  const { username } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState({ code: "", name: "", price: 0, hppPct: 0.3 });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: 0, hppPct: 0.3 });

  if (username === "Bandung" || username === "Jakarta") {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  const load = async () => {
    const res = await fetch("/api/products");
    const data = await res.json();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price), hppPct: Number(form.hppPct) }),
    });
    if (res.ok) {
      setForm({ code: "", name: "", price: 0, hppPct: 0.3 });
      load();
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    load();
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      price: product.price,
      hppPct: product.hppPct,
    });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditForm({ name: "", price: 0, hppPct: 0.3 });
  };

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const res = await fetch(`/api/products/${editingProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        price: Number(editForm.price),
        hppPct: Number(editForm.hppPct),
      }),
    });

    if (res.ok) {
      cancelEdit();
      load();
    }
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Products</h1>
      <p className="text-sm text-gray-600">Gunakan code master tanpa angka depan: contoh <b>HOK-L</b>, <b>HOK-R</b>, <b>BRW</b>. Saat scan barcode seperti <b>212-HOK-L</b>, sistem akan cocokkan ke code master <b>HOK-L</b>.</p>
      <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Code</Label>
          <Input placeholder="HOK-L / HOK-R / BRW" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Name</Label>
          <Input placeholder="Hokkaido Large" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Price (Rp)</Label>
          <Input type="number" placeholder="e.g. 35000" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>HPP % (0-1)</Label>
          <Input type="number" step="0.01" placeholder="e.g. 0.3" value={form.hppPct} onChange={(e) => setForm({ ...form, hppPct: Number(e.target.value) })} />
        </div>
        <div className="flex items-end">
          <Button className="w-full" type="submit">Add</Button>
        </div>
      </form>

      <table className="w-full text-sm border">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left">Code</th>
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-right">Price</th>
            <th className="p-2 text-right">HPP %</th>
            <th className="p-2 text-right">HPP Value</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.code}</td>
              <td className="p-2">{p.name}</td>
              <td className="p-2 text-right">{p.price.toLocaleString("id-ID")}</td>
              <td className="p-2 text-right">{p.hppPct}</td>
              <td className="p-2 text-right">{p.hppValue.toLocaleString("id-ID")}</td>
              <td className="p-2 text-center">
                <div className="flex gap-2 justify-center">
                  <button 
                    onClick={() => startEdit(p)} 
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => remove(p.id)} 
                    className="text-red-600 hover:underline text-sm"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Product</h2>
              <button 
                onClick={cancelEdit}
                className="text-gray-600 hover:text-gray-800 text-xl"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={update} className="space-y-4">
              <div className="flex flex-col gap-1">
                <Label>Product Code</Label>
                <Input 
                  value={editingProduct.code} 
                  disabled 
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500">Product code cannot be changed</p>
              </div>
              
              <div className="flex flex-col gap-1">
                <Label>Name</Label>
                <Input 
                  placeholder="Product name" 
                  value={editForm.name} 
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="flex flex-col gap-1">
                <Label>Price (Rp)</Label>
                <Input 
                  type="number" 
                  placeholder="e.g. 35000" 
                  value={editForm.price} 
                  onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                  required
                />
              </div>
              
              <div className="flex flex-col gap-1">
                <Label>HPP % (0-1)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  placeholder="e.g. 0.3" 
                  value={editForm.hppPct} 
                  onChange={(e) => setEditForm({ ...editForm, hppPct: Number(e.target.value) })}
                  required
                />
                <div className="text-sm text-gray-600">
                  HPP Value: Rp {Math.round(editForm.price * editForm.hppPct).toLocaleString("id-ID")}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={cancelEdit} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Update Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}


