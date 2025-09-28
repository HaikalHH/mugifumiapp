import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

export async function GET(req: NextRequest) {
  try {
    logRouteStart('test-schema');

    // Test basic connection
    const connectionTest = await withRetry(async () => {
      return prisma.$queryRaw`SELECT 1 as test`;
    }, 2, 'test-connection');

    // Test Order table structure
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
          actPayout: true, // This will fail if column doesn't exist
          createdAt: true
        }
      });
    }, 2, 'test-order-schema');

    // Test Product table
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

    logRouteComplete('test-schema');
    return NextResponse.json({
      success: true,
      connection: connectionTest,
      orderSchema: orderTest ? "OK" : "No orders found",
      productSchema: productTest ? "OK" : "No products found",
      message: "All schema tests passed"
    });
  } catch (error) {
    console.error('Schema test error:', error);
    return NextResponse.json(
      createErrorResponse("test schema", error), 
      { status: 500 }
    );
  }
}
