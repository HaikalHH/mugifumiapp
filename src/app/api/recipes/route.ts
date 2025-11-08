import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

// List recipes grouped by product
export async function GET() {
  try {
    logRouteStart('recipes-list');
    const items = await withRetry(async () => {
      return prisma.recipeItem.findMany({
        select: {
          id: true,
          productId: true,
          amountPerKg: true,
          unit: true,
          ingredient: { select: { id: true, code: true, name: true, unit: true } },
          product: { select: { id: true, name: true } },
        },
        orderBy: [{ productId: 'asc' }, { id: 'asc' }]
      });
    }, 2, 'recipes-list');

    // Group by product
    const map = new Map<number, any>();
    for (const r of items) {
      if (!map.has(r.productId)) {
        map.set(r.productId, { product: r.product, items: [] as any[] });
      }
      map.get(r.productId).items.push({
        id: r.id,
        ingredient: r.ingredient,
        amountPerKg: r.amountPerKg,
        unit: r.unit,
      });
    }
    const result = Array.from(map.values());
    logRouteComplete('recipes-list', result.length);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(createErrorResponse("fetch recipes", error), { status: 500 });
  }
}

// Create/replace recipe for a product
export async function POST(req: NextRequest) {
  try {
    logRouteStart('recipes-upsert');
    const body = await req.json();
    const { productId, items } = body as {
      productId: number;
      items: { ingredientId: number; amountPerKg: number; unit: string }[];
    };
    if (!productId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'productId and items[] required' }, { status: 400 });
    }

    const result = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        await tx.recipeItem.deleteMany({ where: { productId } });
        await tx.recipeItem.createMany({
          data: items.map((i) => ({
            productId,
            ingredientId: i.ingredientId,
            amountPerKg: i.amountPerKg,
            unit: i.unit,
          }))
        });
        const rows = await tx.recipeItem.findMany({
          where: { productId },
          select: {
            id: true,
            productId: true,
            amountPerKg: true,
            unit: true,
            ingredient: { select: { id: true, code: true, name: true, unit: true } },
            product: { select: { id: true, name: true } },
          },
          orderBy: { id: 'asc' }
        });
        return rows;
      });
    }, 2, 'recipes-upsert');

    logRouteComplete('recipes-upsert', result.length);
    return NextResponse.json({ success: true, items: result });
  } catch (error) {
    return NextResponse.json(createErrorResponse("upsert recipe", error), { status: 500 });
  }
}
