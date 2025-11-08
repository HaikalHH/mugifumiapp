"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";

type Product = { id: number; name: string };
type Ingredient = { id: number; code: string; name: string; unit: string };
type RecipeItem = { ingredient: Ingredient; amountPerKg: number; unit: string };

export default function PlanningBahanPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allRecipes, setAllRecipes] = useState<{ product: Product; items: RecipeItem[] }[]>([]);
  const [pendingProductId, setPendingProductId] = useState<number | null>(null);
  const [pendingKg, setPendingKg] = useState<number>(1);
  const [selected, setSelected] = useState<{ productId: number; kg: number }[]>([]);

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/plan-products');
    setProducts(await res.json());
  }, []);

  useEffect(() => {
    loadProducts();
    (async () => {
      const res = await fetch('/api/recipes');
      if (res.ok) {
        setAllRecipes(await res.json());
      }
    })();
  }, [loadProducts]);

  const productOptions = useMemo(() => products.map(p => ({ value: String(p.id), label: p.name })), [products]);

  const recipeMap = useMemo(() => {
    const m = new Map<number, RecipeItem[]>();
    for (const g of allRecipes) m.set(g.product.id, g.items);
    return m;
  }, [allRecipes]);

  const aggregated = useMemo(() => {
    const acc = new Map<number, { ingredient: Ingredient; unit: string; total: number }>();
    for (const row of selected) {
      const items = recipeMap.get(row.productId) || [];
      for (const it of items) {
        const curr = acc.get(it.ingredient.id) || { ingredient: it.ingredient, unit: it.unit, total: 0 };
        curr.total += (it.amountPerKg * (row.kg || 0));
        acc.set(it.ingredient.id, curr);
      }
    }
    return Array.from(acc.values());
  }, [selected, recipeMap]);

  const addSelection = () => {
    if (!pendingProductId || pendingKg <= 0) return;
    setSelected((prev) => {
      const existing = prev.find(p => p.productId === pendingProductId);
      if (existing) {
        return prev.map(p => p.productId === pendingProductId ? { ...p, kg: p.kg + pendingKg } : p);
      }
      return [...prev, { productId: pendingProductId, kg: pendingKg }];
    });
    setPendingKg(1);
  };

  const removeSelection = (productId: number) => setSelected(prev => prev.filter(p => p.productId !== productId));

  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Planning Bahan (multi-produk)</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-3 flex flex-col gap-1">
          <Label>Tambah Product</Label>
          <Select value={pendingProductId ? String(pendingProductId) : undefined} onValueChange={(v) => setPendingProductId(Number(v))}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Pilih product" /></SelectTrigger>
            <SelectContent>
              {productOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Target (kg)</Label>
          <Input type="number" step="0.1" value={pendingKg} onChange={(e) => setPendingKg(Number(e.target.value))} />
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={addSelection}>Add</Button>
        </div>
      </div>

      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Produk</TableHead>
              <TableHead className="text-right">Target (kg)</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selected.map((s) => {
              const p = products.find(pp => pp.id === s.productId);
              return (
                <TableRow key={s.productId}>
                  <TableCell>{p ? p.name : s.productId}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" step="0.1" value={s.kg}
                      onChange={(e) => setSelected(prev => prev.map(x => x.productId === s.productId ? { ...x, kg: Number(e.target.value) } : x))}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="outline" className="text-red-600" onClick={() => removeSelection(s.productId)}>Remove</Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {selected.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500">Belum ada produk dipilih.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="text-lg font-medium mt-6 mb-2">Total Kebutuhan Bahan</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Bahan</TableHead>
              <TableHead className="text-right">Unit</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aggregated.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>{row.ingredient.name} ({row.ingredient.code})</TableCell>
                <TableCell className="text-right">{row.unit}</TableCell>
                <TableCell className="text-right">{row.total}</TableCell>
              </TableRow>
            ))}
            {aggregated.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500">Tambahkan produk untuk melihat total kebutuhan bahan.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
