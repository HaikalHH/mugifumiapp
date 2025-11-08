"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

type Product = { id: number; name: string };
type Ingredient = { id: number; code: string; name: string; unit: string };

type RecipeGroup = {
  product: { id: number; name: string };
  items: { id: number; ingredient: Ingredient; amountPerKg: number; unit: string }[];
};

export default function RecipePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<RecipeGroup[]>([]);


  const [addRecipeOpen, setAddRecipeOpen] = useState(false);
  const [recipeProductId, setRecipeProductId] = useState<number | null>(null);
  const [recipeItems, setRecipeItems] = useState<{ ingredientId: number | null; amountPerKg: number; unit: string }[]>([]);
  const [isEdit, setIsEdit] = useState(false);

  const load = useCallback(async () => {
    const [pRes, iRes, rRes] = await Promise.all([
      fetch('/api/plan-products'),
      fetch('/api/ingredients'),
      fetch('/api/recipes'),
    ]);
    setProducts(await pRes.json());
    setIngredients(await iRes.json());
    setRecipes(await rRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const productOptions = useMemo(() => products.map(p => ({ value: String(p.id), label: p.name })), [products]);
  const ingredientOptions = useMemo(() => ingredients.map(i => ({ value: String(i.id), label: `${i.name} (${i.code})` })), [ingredients]);


  const addRecipeRow = () => setRecipeItems(prev => [...prev, { ingredientId: null, amountPerKg: 0, unit: 'gram' }]);
  const removeRecipeRow = (idx: number) => setRecipeItems(prev => prev.filter((_, i) => i !== idx));

  const submitRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeProductId) return;
    const items = recipeItems.filter(r => r.ingredientId && r.amountPerKg > 0).map(r => ({ ingredientId: r.ingredientId as number, amountPerKg: Number(r.amountPerKg), unit: r.unit }));
    if (items.length === 0) return;
    const res = await fetch(isEdit ? `/api/recipes/${recipeProductId}` : '/api/recipes', { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isEdit ? { items } : { productId: recipeProductId, items }) });
    if (res.ok) {
      setRecipeItems([]);
      setRecipeProductId(null);
      setAddRecipeOpen(false);
      setIsEdit(false);
      load();
    }
  };

  const openAdd = () => {
    setIsEdit(false);
    setRecipeItems([]);
    setRecipeProductId(null);
    setAddRecipeOpen(true);
  };

  const openEdit = async (productId: number) => {
    setIsEdit(true);
    setRecipeProductId(productId);
    const res = await fetch(`/api/recipes/${productId}`);
    const rows: any[] = res.ok ? await res.json() : [];
    const mapped = rows.map(r => ({ ingredientId: r.ingredient.id as number, amountPerKg: r.amountPerKg as number, unit: r.unit || r.ingredient.unit }));
    setRecipeItems(mapped);
    setAddRecipeOpen(true);
  };

  const clearRecipe = async (productId: number) => {
    if (!confirm('Hapus semua bahan untuk produk ini?')) return;
    const res = await fetch(`/api/recipes/${productId}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  return (
    <main className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recipe Master (per 1 kg)</h2>
          <div className="flex gap-2">
            <Button onClick={openAdd}>Add Recipe</Button>
          </div>
        </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Product</TableHead>
            <TableHead className="text-left">Ingredients</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.map((rg) => (
            <TableRow key={rg.product.id}>
              <TableCell className="align-top">
                <div className="flex items-center justify-between">
                  <span>{rg.product.name}</span>
                  <span className="flex gap-2 ml-4">
                    <Button variant="link" className="p-0 h-auto" onClick={() => openEdit(rg.product.id)}>Edit</Button>
                    <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => clearRecipe(rg.product.id)}>Clear</Button>
                  </span>
                </div>
              </TableCell>
              <TableCell>
                {rg.items.length === 0 ? (
                  <span className="text-gray-500">No items</span>
                ) : (
                  <div className="space-y-1">
                    {rg.items.map((it) => (
                      <div key={it.id} className="text-sm">• {it.ingredient.name} ({it.ingredient.code}) — {it.amountPerKg} {it.unit} / kg</div>
                    ))}
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>


      {/* Add Recipe Dialog */}
      <Dialog open={addRecipeOpen} onOpenChange={setAddRecipeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitRecipe} className="space-y-4">
            <div className="flex flex-col gap-1">
              <Label>Product</Label>
              <Select value={recipeProductId ? String(recipeProductId) : undefined} onValueChange={(v) => setRecipeProductId(Number(v))} disabled={isEdit}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih product" /></SelectTrigger>
                <SelectContent>
                  {productOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Ingredients (per 1 kg)</Label>
                <Button type="button" variant="outline" onClick={addRecipeRow}>Add</Button>
              </div>
              {recipeItems.length === 0 && (
                <div className="text-sm text-gray-500">Belum ada bahan. Klik Add untuk menambah baris.</div>
              )}
              {recipeItems.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                  <div className="md:col-span-3">
                    <Label className="text-xs">Bahan</Label>
                    <Select value={row.ingredientId ? String(row.ingredientId) : undefined} onValueChange={(v) => setRecipeItems(prev => prev.map((r, i) => {
                      if (i !== idx) return r;
                      const ing = ingredients.find(ii => String(ii.id) === v);
                      return { ...r, ingredientId: Number(v), unit: ing?.unit || r.unit };
                    }))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih bahan" /></SelectTrigger>
                      <SelectContent>
                        {ingredientOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Jumlah / kg</Label>
                    <Input type="number" step="0.01" value={row.amountPerKg} onChange={(e) => setRecipeItems(prev => prev.map((r, i) => i === idx ? { ...r, amountPerKg: Number(e.target.value) } : r))} />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select value={row.unit} onValueChange={(v) => setRecipeItems(prev => prev.map((r, i) => i === idx ? { ...r, unit: v } : r))}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Unit" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gram">gram</SelectItem>
                        <SelectItem value="liter">liter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" className="text-red-600" onClick={() => removeRecipeRow(idx)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRecipeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!recipeProductId || recipeItems.length === 0}>{isEdit ? 'Update Recipe' : 'Save Recipe'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
