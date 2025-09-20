import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const location = searchParams.get("location") || undefined;
    const productCode = searchParams.get("productCode") || undefined;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where = {
      location: location,
      product: productCode ? { code: productCode } : undefined,
      // MySQL provider here does not support mode on StringFilter; use case-sensitive contains
      // If case-insensitive needed, consider lowercasing both sides or using full-text indexes
      barcode: search ? { contains: search } : undefined,
      status: status || undefined,
    };

    const [items, totalCount] = await Promise.all([
      prisma.inventory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          barcode: true,
          location: true,
          status: true,
          createdAt: true,
          product: { select: { code: true, name: true, price: true } },
        },
      }),
      prisma.inventory.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to list inventory items" }, { status: 500 });
  }
}


