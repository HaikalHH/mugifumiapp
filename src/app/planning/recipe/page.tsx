"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";

type Ingredient = { id: number; code: string; name: string; unit: string };

type RecipeGroup = {
  product: { id: number; name: string };
  items: { id: number; ingredient: Ingredient; amountPerKg: number; unit: string }[];
};

export default function RecipePage() {
  const [recipes, setRecipes] = useState<RecipeGroup[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/recipes');
    setRecipes(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

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
          <Button asChild>
            <Link href="/planning/recipe/new">Add Recipe</Link>
          </Button>
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
                <div className="flex items-center justify-between gap-2">
                  <span>{rg.product.name}</span>
                  <span className="flex gap-2">
                    <Button variant="link" className="p-0 h-auto" asChild>
                      <Link href={`/planning/recipe/${rg.product.id}/edit`}>Edit</Link>
                    </Button>
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
          {recipes.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-gray-500">Belum ada recipe.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
