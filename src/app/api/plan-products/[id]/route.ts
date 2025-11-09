import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

async function getId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const planProductId = parseInt(id);
  if (isNaN(planProductId)) {
    throw new Error("INVALID_ID");
  }
  return planProductId;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart("plan-products-detail");
    let planProductId: number;
    try {
      planProductId = await getId(params);
    } catch (error) {
      if ((error as Error).message === "INVALID_ID") {
        return NextResponse.json({ error: "Invalid plan product ID" }, { status: 400 });
      }
      throw error;
    }

    const product = await withRetry(
      () =>
        prisma.planProduct.findUnique({
          where: { id: planProductId },
          select: { id: true, name: true, createdAt: true, updatedAt: true },
        }),
      2,
      "plan-products-detail",
    );

    if (!product) {
      return NextResponse.json({ error: "Plan product not found" }, { status: 404 });
    }

    logRouteComplete("plan-products-detail", 1);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(createErrorResponse("get plan product", error), { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart("plan-products-update");
    let planProductId: number;
    try {
      planProductId = await getId(params);
    } catch (error) {
      if ((error as Error).message === "INVALID_ID") {
        return NextResponse.json({ error: "Invalid plan product ID" }, { status: 400 });
      }
      throw error;
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const updated = await withRetry(
      () =>
        prisma.planProduct.update({
          where: { id: planProductId },
          data: { name },
          select: { id: true, name: true, createdAt: true, updatedAt: true },
        }),
      2,
      "plan-products-update",
    );

    logRouteComplete("plan-products-update");
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(createErrorResponse("update plan product", error), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart("plan-products-delete");
    let planProductId: number;
    try {
      planProductId = await getId(params);
    } catch (error) {
      if ((error as Error).message === "INVALID_ID") {
        return NextResponse.json({ error: "Invalid plan product ID" }, { status: 400 });
      }
      throw error;
    }

    const usageCount = await prisma.recipeItem.count({ where: { productId: planProductId } });
    if (usageCount > 0) {
      return NextResponse.json({ error: "Plan product sedang dipakai di Recipe" }, { status: 400 });
    }

    await withRetry(() => prisma.planProduct.delete({ where: { id: planProductId } }), 2, "plan-products-delete");
    logRouteComplete("plan-products-delete", 1);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(createErrorResponse("delete plan product", error), { status: 500 });
  }
}
