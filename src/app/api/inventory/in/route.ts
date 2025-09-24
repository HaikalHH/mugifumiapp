import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { parseBarcode } from "../../../../lib/barcode";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { barcode, location } = body as { barcode: string; location: string };
    
    if (!barcode || !location) {
      return NextResponse.json({ error: "barcode and location are required" }, { status: 400 });
    }

    logRouteStart('inventory-in', { barcode, location });

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

    // Check if barcode already exists
    const existingInventory = await withRetry(async () => {
      return prisma.inventory.findUnique({
        where: { barcode: parsed.raw },
        select: {
          id: true,
          barcode: true,
          location: true,
          status: true,
          productId: true,
          createdAt: true
        }
      });
    }, 2, 'inventory-in-check-existing');

    let result;
    let action = 'created';

    if (existingInventory) {
      // If barcode exists in different location, auto-move it
      if (existingInventory.location !== location) {
        result = await withRetry(async () => {
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
        action = 'moved';
      } else {
        // Barcode already exists in the same location
        return NextResponse.json({ 
          error: "Barcode sudah ada di lokasi yang sama",
          existing: existingInventory 
        }, { status: 409 });
      }
    } else {
      // Create new inventory item
      result = await withRetry(async () => {
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
    }

    logRouteComplete('inventory-in', 1);
    return NextResponse.json({ 
      ...result, 
      action: action,
      message: action === 'moved' 
        ? `Barcode berhasil dipindahkan dari ${existingInventory?.location} ke ${location}`
        : 'Barcode berhasil ditambahkan ke inventory'
    }, { status: 201 });
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


