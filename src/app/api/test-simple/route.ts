import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    logRouteStart('test-simple');

    // Test basic connection
    const connectionTest = await withRetry(async () => {
      return prisma.$queryRaw`SELECT 1 as test`;
    }, 2, 'test-connection');

    // Test Product table (should work)
    const productTest = await withRetry(async () => {
      return prisma.product.findFirst({
        select: {
          id: true,
          code: true,
          name: true,
          price: true
        }
      });
    }, 2, 'test-product-schema');

    // Test Order table without actPayout field
    const orderTest = await withRetry(async () => {
      return prisma.order.findFirst({
        select: {
          id: true,
          outlet: true,
          customer: true,
          status: true,
          orderDate: true,
          location: true,
          discount: true,
          totalAmount: true,
          createdAt: true
          // actPayout: true, // Commented out to test without this field
        }
      });
    }, 2, 'test-order-schema');

    logRouteComplete('test-simple');
    return NextResponse.json({
      success: true,
      connection: connectionTest,
      orderSchema: orderTest ? "OK" : "No orders found",
      productSchema: productTest ? "OK" : "No products found",
      message: "Basic schema tests passed"
    });
  } catch (error) {
    console.error('Simple test error:', error);
    return NextResponse.json(
      createErrorResponse("test simple", error), 
      { status: 500 }
    );
  }
}
