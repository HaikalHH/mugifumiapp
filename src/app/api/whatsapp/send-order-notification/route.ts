import { NextRequest, NextResponse } from "next/server";
import { sendOrderNotification, OrderNotificationData } from "../../../../lib/ultramsg";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function POST(req: NextRequest) {
  try {
    logRouteStart('whatsapp-send-order-notification', {});

    const body = await req.json();
    const { outlet, location, customer, total, items } = body as OrderNotificationData;
    
    if (!outlet || !location || !customer || !total || !items || !Array.isArray(items)) {
      return NextResponse.json({ 
        error: "outlet, location, customer, total, and items are required" 
      }, { status: 400 });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.name || !item.quantity || !item.price || !item.subtotal) {
        return NextResponse.json({ 
          error: "Each item must have name, quantity, price, and subtotal" 
        }, { status: 400 });
      }
    }

    const orderData: OrderNotificationData = {
      outlet,
      location,
      customer,
      total,
      items
    };

    // Send WhatsApp notification
    const result = await sendOrderNotification(orderData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    logRouteComplete('whatsapp-send-order-notification', 1);
    return NextResponse.json({ 
      success: true, 
      message: result.message,
      results: result.results
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("send order notification", error),
      { status: 500 }
    );
  }
}
