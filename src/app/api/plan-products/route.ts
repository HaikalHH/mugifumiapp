import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

export async function GET() {
  try {
    logRouteStart("plan-products-list");
    const data = await withRetry(
      () =>
        prisma.planProduct.findMany({
          select: { id: true, name: true, createdAt: true, updatedAt: true },
          orderBy: { id: "desc" },
        }),
      2,
      "plan-products-list",
    );
    logRouteComplete("plan-products-list", data.length);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(createErrorResponse("list plan products", error), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart("plan-products-create");
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const created = await withRetry(
      () =>
        prisma.planProduct.create({
          data: { name },
          select: { id: true, name: true, createdAt: true, updatedAt: true },
        }),
      2,
      "plan-products-create",
    );

    logRouteComplete("plan-products-create", 1);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(createErrorResponse("create plan product", error), { status: 500 });
  }
}
