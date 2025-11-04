import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart('ingredients-update');
    const { id } = await params;
    const ingredientId = parseInt(id);
    if (isNaN(ingredientId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await req.json();
    const { name, unit } = body as { name: string; unit: string };
    if (!name || !unit) return NextResponse.json({ error: 'name, unit required' }, { status: 400 });

    const updated = await withRetry(async () => {
      return prisma.ingredient.update({
        where: { id: ingredientId },
        data: { name, unit },
        select: { id: true, code: true, name: true, unit: true, createdAt: true, updatedAt: true }
      });
    }, 2, 'ingredients-update');

    logRouteComplete('ingredients-update', 1);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(createErrorResponse("update ingredient", error), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart('ingredients-delete');
    const { id } = await params;
    const ingredientId = parseInt(id);
    if (isNaN(ingredientId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    await withRetry(async () => {
      return prisma.ingredient.delete({ where: { id: ingredientId } });
    }, 2, 'ingredients-delete');

    logRouteComplete('ingredients-delete', 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(createErrorResponse("delete ingredient", error), { status: 500 });
  }
}

