"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

type Product = { id: number; name: string };
type Ingredient = { id: number; code: string; name: string; unit: string };

type RecipeRow = { ingredientId: number | null; amountPerKg: number; unit: string };

type RecipeFormProps = {
  mode: "create" | "edit";
  productId?: number;
};

export function RecipeForm({ mode, productId }: RecipeFormProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(productId ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, iRes] = await Promise.all([
        fetch('/api/plan-products'),
        fetch('/api/ingredients'),
      ]);
      const [productList, ingredientList] = await Promise.all([pRes.json(), iRes.json()]);
      setProducts(productList);
      setIngredients(ingredientList);

      if (mode === "edit" && productId) {
        const recipeRes = await fetch(`/api/recipes/${productId}`);
        if (recipeRes.ok) {
          const data = await recipeRes.json();
          setRows(data.map((r: any) => ({ ingredientId: r.ingredient.id, amountPerKg: r.amountPerKg, unit: r.unit || r.ingredient.unit })));
        } else {
          setRows([]);
        }
        setSelectedProductId(productId);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, productId]);

  useEffect(() => { load(); }, [load]);

  const ingredientOptions = useMemo(() => ingredients.map((i) => ({ value: String(i.id), label: `${i.name} (${i.code})` })), [ingredients]);

  const addRow = () => setRows((prev) => [...prev, { ingredientId: null, amountPerKg: 0, unit: 'gram' }]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit = Boolean(selectedProductId) && rows.some((r) => r.ingredientId && r.amountPerKg > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    const items = rows
      .filter((r) => r.ingredientId && r.amountPerKg > 0)
      .map((r) => ({ ingredientId: r.ingredientId as number, amountPerKg: Number(r.amountPerKg), unit: r.unit }));
    if (items.length === 0) return;

    setSaving(true);
    try {
      const url = mode === "edit" ? `/api/recipes/${selectedProductId}` : '/api/recipes';
      const method = mode === "edit" ? 'PUT' : 'POST';
      const body = mode === "edit" ? { items } : { productId: selectedProductId, items };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        router.push('/planning/recipe');
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const title = mode === "edit" ? `Edit Recipe${selectedProduct ? ` - ${selectedProduct.name}` : ''}` : 'Add Recipe';

  if (loading) {
    return (
      <main className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="outline" asChild>
              <Link href="/planning/recipe">Back</Link>
            </Button>
          </div>
        </div>
        <div className="text-sm text-gray-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/planning/recipe">Back</Link>
            </Button>
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          {selectedProduct && (
            <p className="text-sm text-gray-600">Mengatur kebutuhan bahan untuk {selectedProduct.name}.</p>
          )}
        </div>
        <Button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={!canSubmit || saving}>
          {saving ? 'Saving...' : 'Save Recipe'}
        </Button>
      </div>

      <form ref={formRef} id="recipe-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-1">
          <Label>Product</Label>
          <Select value={selectedProductId ? String(selectedProductId) : undefined} onValueChange={(v) => setSelectedProductId(Number(v))} disabled={mode === "edit"}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Ingredients (per 1 kg)</Label>
            <Button type="button" variant="outline" onClick={addRow}>Add</Button>
          </div>
          {rows.length === 0 && (
            <div className="text-sm text-gray-500">Belum ada bahan. Klik Add untuk menambah baris.</div>
          )}
          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border rounded-lg p-3">
                <div className="md:col-span-3">
                  <Label className="text-xs">Bahan</Label>
                  <Select value={row.ingredientId ? String(row.ingredientId) : undefined} onValueChange={(v) => setRows((prev) => prev.map((r, i) => {
                    if (i !== idx) return r;
                    const ing = ingredients.find((ii) => String(ii.id) === v);
                    return { ...r, ingredientId: Number(v), unit: ing?.unit || r.unit };
                  }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                    <SelectContent className="max-h-72 overflow-auto">
                      {ingredientOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Jumlah / kg</Label>
                  <Input type="number" step="0.01" value={row.amountPerKg} onChange={(e) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, amountPerKg: Number(e.target.value) } : r))} />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select value={row.unit} onValueChange={(v) => setRows((prev) => prev.map((r, i) => i === idx ? { ...r, unit: v } : r))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gram">gram</SelectItem>
                      <SelectItem value="liter">liter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="outline" className="text-red-600 w-full" onClick={() => removeRow(idx)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit || saving}>
            {saving ? 'Saving...' : 'Save Recipe'}
          </Button>
        </div>
      </form>
    </main>
  );
}
