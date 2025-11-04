import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    logRouteStart('recipe-get');
    const { productId } = await params;
    const pid = parseInt(productId);
    if (isNaN(pid)) return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });

    const rows = await withRetry(async () => {
      return prisma.recipeItem.findMany({
        where: { productId: pid },
        select: {
          id: true,
          productId: true,
          amountPerKg: true,
          unit: true,
          ingredient: { select: { id: true, code: true, name: true, unit: true } },
          product: { select: { id: true, code: true, name: true } },
        },
        orderBy: { id: 'asc' }
      });
    }, 2, 'recipe-get');

    logRouteComplete('recipe-get', rows.length);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(createErrorResponse("get recipe", error), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    logRouteStart('recipe-update');
    const { productId } = await params;
    const pid = parseInt(productId);
    if (isNaN(pid)) return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });

    const body = await req.json();
    const { items } = body as { items: { ingredientId: number; amountPerKg: number; unit: string }[] };
    if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: 'items[] required' }, { status: 400 });

    const rows = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        await tx.recipeItem.deleteMany({ where: { productId: pid } });
        await tx.recipeItem.createMany({ data: items.map(i => ({ productId: pid, ingredientId: i.ingredientId, amountPerKg: i.amountPerKg, unit: i.unit })) });
        return tx.recipeItem.findMany({
          where: { productId: pid },
          select: {
            id: true,
            productId: true,
            amountPerKg: true,
            unit: true,
            ingredient: { select: { id: true, code: true, name: true, unit: true } },
            product: { select: { id: true, code: true, name: true } },
          },
          orderBy: { id: 'asc' }
        });
      });
    }, 2, 'recipe-update');

    logRouteComplete('recipe-update', rows.length);
    return NextResponse.json({ success: true, items: rows });
  } catch (error) {
    return NextResponse.json(createErrorResponse("update recipe", error), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  try {
    logRouteStart('recipe-delete');
    const { productId } = await params;
    const pid = parseInt(productId);
    if (isNaN(pid)) return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });

    await withRetry(async () => prisma.recipeItem.deleteMany({ where: { productId: pid } }), 2, 'recipe-delete');
    logRouteComplete('recipe-delete', 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(createErrorResponse("delete recipe", error), { status: 500 });
  }
}

