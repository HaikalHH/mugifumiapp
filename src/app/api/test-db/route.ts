import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test if new tables exist
    const orderCount = await prisma.order.count();
    console.log(`✅ Order table exists, count: ${orderCount}`);
    
    const deliveryCount = await prisma.delivery.count();
    console.log(`✅ Delivery table exists, count: ${deliveryCount}`);
    
    // Test a simple query with error handling
    let productCount = 0;
    try {
      const products = await prisma.product.findMany({ take: 1 });
      productCount = products.length;
      console.log(`✅ Product query successful, found ${productCount} products`);
    } catch (productError) {
      console.log('⚠️ Product query failed:', productError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database test completed',
      results: {
        orderTableExists: true,
        orderCount,
        deliveryTableExists: true,
        deliveryCount,
        productQuerySuccess: productCount > 0,
        productCount
      }
    });
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}
