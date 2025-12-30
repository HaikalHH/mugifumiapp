import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { parseBarcode } from "../../../../lib/barcode";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

function generateManualBarcode(productCode: string) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AUTO-${productCode.toUpperCase()}-${timestamp}-${random}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcode, location, productCode, quantity } = body as { barcode?: string; location?: string; productCode?: string; quantity?: number };
    
    if (!location) {
      return NextResponse.json({ error: "location is required" }, { status: 400 });
    }

    const isManual = !barcode && productCode;
    if (!barcode && !productCode) {
      return NextResponse.json({ error: "barcode or productCode is required" }, { status: 400 });
    }

    logRouteStart('inventory-in', { barcode, location, productCode, quantity });

    if (isManual) {
      const trimmedCode = productCode!.trim().toUpperCase();
      if (!trimmedCode) {
        return NextResponse.json({ error: "productCode is required" }, { status: 400 });
      }
      const qty = typeof quantity === "number" && Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;

      const product = await withRetry(async () => {
        return prisma.product.findUnique({
          where: { code: trimmedCode },
          select: { id: true, code: true, name: true },
        });
      }, 2, "inventory-in-manual-product");

      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }

      const createdItems = [];
      for (let i = 0; i < qty; i += 1) {
        const generatedBarcode = generateManualBarcode(trimmedCode);
        const created = await withRetry(async () => {
          return prisma.inventory.create({
            data: {
              barcode: generatedBarcode,
              location,
              productId: product.id,
            },
            select: {
              id: true,
              barcode: true,
              location: true,
              status: true,
              productId: true,
              createdAt: true,
            },
          });
        }, 2, "inventory-in-manual-create");
        createdItems.push(created);
      }

      logRouteComplete("inventory-in", createdItems.length);
      return NextResponse.json({ items: createdItems, count: createdItems.length }, { status: 201 });
    }

    if (!barcode) {
      return NextResponse.json({ error: "barcode is required" }, { status: 400 });
    }

    const parsed = parseBarcode(barcode);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid barcode format" }, { status: 400 });
    }

    // Map to master code (e.g., HOK-L, HOK-R, BRW)
    const product = await withRetry(async () => {
      return prisma.product.findUnique({ 
        where: { code: parsed.masterCode },
        select: { id: true, code: true, name: true }
      });
    }, 2, 'inventory-in-product');
    
    if (!product) {
      return NextResponse.json({ error: "Product not found for barcode" }, { status: 404 });
    }

    // Check if barcode already exists in inventory
    const existingItem = await withRetry(async () => {
      return prisma.inventory.findUnique({
        where: { barcode: parsed.raw },
        select: {
          id: true,
          barcode: true,
          location: true,
          status: true,
          productId: true
        }
      });
    }, 2, 'inventory-in-check-existing');

    if (existingItem) {
      // If barcode exists but in different location, auto-move it
      if (existingItem.location !== location) {
        const updated = await withRetry(async () => {
          return prisma.inventory.update({
            where: { barcode: parsed.raw },
            data: { location: location },
            select: {
              id: true,
              barcode: true,
              location: true,
              status: true,
              productId: true,
              createdAt: true
            }
          });
        }, 2, 'inventory-in-auto-move');

        logRouteComplete('inventory-in', 1);
        return NextResponse.json({
          ...updated,
          action: 'moved',
          message: `Item ${parsed.raw} berhasil dipindahkan dari ${existingItem.location} ke ${location}`
        }, { status: 200 });
      } else {
        // Barcode exists in same location
        return NextResponse.json({ error: "Barcode already exists in this location" }, { status: 409 });
      }
    }

    // Create new inventory item if barcode doesn't exist
    const created = await withRetry(async () => {
      return prisma.inventory.create({
        data: {
          barcode: parsed.raw,
          location,
          productId: product.id,
        },
        select: {
          id: true,
          barcode: true,
          location: true,
          status: true,
          productId: true,
          createdAt: true
        }
      });
    }, 2, 'inventory-in-create');

    logRouteComplete('inventory-in', 1);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Barcode already exists in inventory" }, { status: 409 });
    }
    return NextResponse.json(
      createErrorResponse("add inventory", error), 
      { status: 500 }
    );
  }
}

