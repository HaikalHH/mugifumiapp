import { NextRequest, NextResponse } from "next/server";
import { sendDeliveryNotification, DeliveryNotificationData } from "../../../../lib/ultramsg";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

export async function POST(req: NextRequest) {
  try {
    logRouteStart('whatsapp-send-delivery-notification', {});

    const body = await req.json();
    const { 
      outlet, 
      location, 
      customer, 
      orderId, 
      deliveryDate, 
      ongkirPlan, 
      ongkirActual, 
      items 
    } = body as DeliveryNotificationData;
    
    if (!outlet || !location || !customer || !orderId || !deliveryDate || 
        ongkirPlan === undefined || ongkirActual === undefined || !items || !Array.isArray(items)) {
      return NextResponse.json({ 
        error: "outlet, location, customer, orderId, deliveryDate, ongkirPlan, ongkirActual, and items are required" 
      }, { status: 400 });
    }

    // Validate items structure
    for (const item of items) {
      if (!item.name || !item.barcode || !item.price) {
        return NextResponse.json({ 
          error: "Each item must have name, barcode, and price" 
        }, { status: 400 });
      }
    }

    // Calculate cost difference and percentage
    const costDifference = ongkirActual - ongkirPlan;
    const costDifferencePercent = ongkirPlan > 0 ? (costDifference / ongkirPlan) * 100 : 0;

    const deliveryData: DeliveryNotificationData = {
      outlet,
      location,
      customer,
      orderId,
      deliveryDate,
      ongkirPlan,
      ongkirActual,
      costDifference,
      costDifferencePercent,
      items
    };

    // Send WhatsApp notification
    const result = await sendDeliveryNotification(deliveryData);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    logRouteComplete('whatsapp-send-delivery-notification', 1);
    return NextResponse.json({ 
      success: true, 
      message: result.message,
      results: result.results
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("send delivery notification", error),
      { status: 500 }
    );
  }
}
