"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

type Ingredient = {
  id: number;
  code: string;
  name: string;
  unit: string;
};

type RecipeItemRow = {
  id: number;
  amountPerKg: number;
  unit: string;
  ingredient: Ingredient;
  product?: { id: number; name: string };
};

type PlanProduct = { id: number; name: string };

type RecipeDetailProps = {
  productId: number;
};

const amountFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function RecipeDetail({ productId }: RecipeDetailProps) {
  const [product, setProduct] = useState<PlanProduct | null>(null);
  const [items, setItems] = useState<RecipeItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      setItems([]);
      setProduct(null);
      try {
        const recipeRes = await fetch(`/api/recipes/${productId}`, { cache: "no-store" });
        if (!recipeRes.ok) {
          throw new Error("RECIPE_FETCH_FAILED");
        }
        const recipeData: RecipeItemRow[] = await recipeRes.json();
        if (cancelled) return;

        setItems(recipeData);
        const productFromRecipe = recipeData[0]?.product;
        if (productFromRecipe) {
          setProduct(productFromRecipe);
        } else {
          const productRes = await fetch(`/api/plan-products/${productId}`, { cache: "no-store" });
          if (productRes.ok) {
            const planProduct: PlanProduct = await productRes.json();
            if (!cancelled) {
              setProduct(planProduct);
            }
          }
        }
      } catch {
        if (!cancelled) {
          setError("Gagal memuat data recipe.");
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const title = product ? `Recipe - ${product.name}` : "Recipe Detail";

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/planning/recipe">Back</Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-gray-600">Kebutuhan bahan per 1 kg produk.</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/planning/recipe/${productId}/edit`}>Edit Recipe</Link>
        </Button>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading recipe detail...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <>
          {items.length === 0 ? (
            <div className="rounded border border-dashed p-6 text-center text-sm text-gray-500">
              Belum ada ingredient untuk produk ini.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Ingredient</TableHead>
                  <TableHead className="text-left">Code</TableHead>
                  <TableHead className="text-right">Amount / kg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.ingredient.name}</TableCell>
                    <TableCell>{item.ingredient.code}</TableCell>
                    <TableCell className="text-right">
                      {amountFormatter.format(item.amountPerKg)} {item.unit || item.ingredient.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </main>
  );
}
