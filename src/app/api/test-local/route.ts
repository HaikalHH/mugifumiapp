import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const start = Date.now();
    
    // Test connection
    await prisma.$queryRaw`SELECT 1 as test`;
    const latency = Date.now() - start;
    
    // Count products
    const productCount = await prisma.product.count();
    const inventoryCount = await prisma.inventory.count();
    
    return NextResponse.json({
      status: 'connected',
      latency: `${latency}ms`,
      environment: 'local development',
      database_region: process.env.DATABASE_URL?.includes('ap-southeast-1') ? 'Singapore' : 'Unknown',
      counts: {
        products: productCount,
        inventory: inventoryCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      environment: 'local development'
    }, { status: 500 });
  }
}