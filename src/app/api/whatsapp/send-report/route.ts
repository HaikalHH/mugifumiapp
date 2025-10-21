import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";

// WhatsApp API configuration
const ULTRAMSG_INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID || "instance146361";
const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || "0dphdxuuhgdfhtja";
const ULTRAMSG_PHONES = process.env.ULTRAMSG_PHONES || "+6281275167471,+6281378471123,+6281276167733,+6281261122306";
const ULTRAMSG_BASE_URL = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}`;

// Parse phone numbers from comma-separated string
const PHONE_NUMBERS = ULTRAMSG_PHONES.split(',').map(phone => phone.trim());

interface OutletRegionData {
  count: number;
  actual: number;
  potonganPct: number | null;
  ongkirPotongan: number;
}

async function sendWhatsAppMessage(message: string, phoneNumber: string): Promise<boolean> {
  try {
    const response = await fetch(`${ULTRAMSG_BASE_URL}/messages/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: ULTRAMSG_TOKEN,
        to: phoneNumber,
        body: message,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to send WhatsApp message to ${phoneNumber}:`, await response.text());
      return false;
    }

    const result = await response.json();
    console.log(`WhatsApp message sent successfully to ${phoneNumber}:`, result);
    return true;
  } catch (error) {
    console.error(`Error sending WhatsApp message to ${phoneNumber}:`, error);
    return false;
  }
}

async function sendWhatsAppToMultipleNumbers(message: string): Promise<{ total: number; success: number; failed: number; results: Array<{ phone: string; success: boolean }> }> {
  const results = await Promise.all(
    PHONE_NUMBERS.map(async (phone) => {
      const success = await sendWhatsAppMessage(message, phone);
      return { phone, success };
    })
  );

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;

  return {
    total: PHONE_NUMBERS.length,
    success: successCount,
    failed: failedCount,
    results,
  };
}

async function getOutletRegionReport(date?: Date): Promise<{ byOutletRegion: Record<string, OutletRegionData>; totalActual: number; totalOngkirPotongan: number; orderCount: number }> {
  // If no date provided, use today
  const targetDate = date || new Date();
  
  // Set to Jakarta timezone start and end of day
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const whereOrder: any = {
    orderDate: {
      gte: startOfDay,
      lte: endOfDay,
    }
  };

  const orders = await withRetry(async () => {
    return prisma.order.findMany({
      where: whereOrder,
      select: {
        id: true,
        outlet: true,
        location: true,
        orderDate: true,
        discount: true,
        totalAmount: true,
        actPayout: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            price: true
          }
        },
        deliveries: {
          select: {
            id: true,
            ongkirPlan: true,
            ongkirActual: true,
            status: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });
  }, 2, 'whatsapp-report-orders');

  if (orders.length === 0) {
    return { byOutletRegion: {}, totalActual: 0, totalOngkirPotongan: 0, orderCount: 0 };
  }

  const needsDiscount = (ot: string) => {
    const k = ot.toLowerCase();
    return k === "whatsapp" || k === "cafe" || k === "wholesale";
  };

  const perSale = orders.map((order) => {
    const orderItems = order.items || [];
    const isCafe = order.outlet.toLowerCase() === "cafe";
    const isFree = order.outlet.toLowerCase() === "free";
    
    // Calculate subtotal from order items
    const preDiscountSubtotal = orderItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    const discountPct = needsDiscount(order.outlet) && typeof order.discount === "number" ? order.discount : 0;

    // Calculate ongkir potongan from deliveries (only for WhatsApp outlet)
    let ongkirPotongan = 0;
    if (order.outlet.toLowerCase() === "whatsapp" && order.deliveries && order.deliveries.length > 0) {
      for (const delivery of order.deliveries) {
        if (delivery.ongkirPlan && delivery.ongkirActual && delivery.status === "delivered") {
          const ongkirDifference = delivery.ongkirActual - delivery.ongkirPlan;
          if (ongkirDifference > 0) {
            ongkirPotongan += ongkirDifference;
          }
        }
      }
    }

    // For orders, actual received is actPayout if available, otherwise totalAmount
    // For Free outlet, set to 0
    // For Cafe outlet, if no actPayout, set to 0
    const actual = isFree ? 0 : (isCafe ? (order.actPayout ?? 0) : (order.actPayout || order.totalAmount || null));

    // Potongan calculation for orders (include ongkir potongan)
    const potongan = isFree
      ? preDiscountSubtotal + ongkirPotongan
      : (isCafe
        ? (preDiscountSubtotal - (actual ?? 0) + ongkirPotongan)
        : (actual != null ? (preDiscountSubtotal - actual + ongkirPotongan) : null));

    const potonganPct = isFree
      ? 100
      : (isCafe
        ? (preDiscountSubtotal > 0 ? Math.round(((potongan as number / preDiscountSubtotal) * 100) * 10) / 10 : null)
        : (potongan != null && preDiscountSubtotal > 0 ? Math.round((potongan / preDiscountSubtotal) * 1000) / 10 : null));

    return {
      id: order.id,
      outlet: order.outlet,
      location: order.location,
      orderDate: order.orderDate,
      actualReceived: actual,
      potongan,
      potonganPct,
      originalBeforeDiscount: preDiscountSubtotal,
      ongkirPotongan,
    };
  });

  const byOutletRegionAgg: Record<string, { count: number; actual: number; original: number; potongan: number; ongkirPotongan: number }> = {};
  let totalActual = 0;
  let totalOriginal = 0;
  let totalPotongan = 0;
  let totalOngkirPotongan = 0;
  
  for (const row of perSale) {
    const regionKey = `${row.outlet} ${row.location}`.trim();
    byOutletRegionAgg[regionKey] ||= { count: 0, actual: 0, original: 0, potongan: 0, ongkirPotongan: 0 };
    byOutletRegionAgg[regionKey].count += 1;
    byOutletRegionAgg[regionKey].actual += row.actualReceived || 0;
    byOutletRegionAgg[regionKey].original += row.originalBeforeDiscount || 0;
    byOutletRegionAgg[regionKey].potongan += row.potongan || 0;
    byOutletRegionAgg[regionKey].ongkirPotongan += row.ongkirPotongan || 0;
    totalActual += row.actualReceived || 0;
    totalOriginal += row.originalBeforeDiscount || 0;
    totalPotongan += row.potongan || 0;
    totalOngkirPotongan += row.ongkirPotongan || 0;
  }

  const byOutletRegion: Record<string, OutletRegionData> = Object.fromEntries(
    Object.entries(byOutletRegionAgg).map(([k, v]) => [
      k,
      {
        count: v.count,
        actual: v.actual,
        potonganPct: v.original > 0 ? Math.round(((v.potongan / v.original) * 100) * 10) / 10 : null,
        ongkirPotongan: v.ongkirPotongan,
      },
    ])
  );

  return {
    byOutletRegion,
    totalActual,
    totalOngkirPotongan,
    orderCount: orders.length,
  };
}

function formatReportMessage(data: { byOutletRegion: Record<string, OutletRegionData>; totalActual: number; totalOngkirPotongan: number; orderCount: number }, date: Date): string {
  const dateStr = date.toLocaleDateString("id-ID", { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let message = `📊 *LAPORAN PENJUALAN HARIAN*\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (Object.keys(data.byOutletRegion).length === 0) {
    message += `Tidak ada transaksi hari ini.\n`;
  } else {
    message += `*OUTLET + REGION*\n\n`;
    
    // Sort by actual amount descending
    const sorted = Object.entries(data.byOutletRegion).sort((a, b) => b[1].actual - a[1].actual);
    
    for (const [key, value] of sorted) {
      message += `📍 *${key}*\n`;
      message += `   • Transaksi: ${value.count}\n`;
      message += `   • Actual: Rp ${value.actual.toLocaleString("id-ID")}\n`;
      message += `   • Potongan: ${value.potonganPct != null ? `${value.potonganPct}%` : "-"}\n`;
      if (value.ongkirPotongan > 0) {
        message += `   • Ongkir Potongan: Rp ${value.ongkirPotongan.toLocaleString("id-ID")}\n`;
      }
      message += `\n`;
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*TOTAL*\n`;
    message += `📦 Total Transaksi: ${data.orderCount}\n`;
    message += `💰 Total Actual: Rp ${data.totalActual.toLocaleString("id-ID")}\n`;
    if (data.totalOngkirPotongan > 0) {
      message += `🚚 Total Ongkir Potongan: Rp ${data.totalOngkirPotongan.toLocaleString("id-ID")}\n`;
    }
  }

  message += `\n_Laporan otomatis dari Mugifumi App_`;

  return message;
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart('whatsapp-send-report', {});

    // Get date from request body (optional, defaults to today)
    const body = await req.json().catch(() => ({}));
    const dateParam = body.date ? new Date(body.date) : new Date();

    // Get report data
    const reportData = await getOutletRegionReport(dateParam);

    // Format message
    const message = formatReportMessage(reportData, dateParam);

    // Send WhatsApp message to multiple numbers
    const sendResult = await sendWhatsAppToMultipleNumbers(message);

    if (sendResult.success === 0) {
      return NextResponse.json(
        { error: "Failed to send WhatsApp message to all recipients" },
        { status: 500 }
      );
    }

    logRouteComplete('whatsapp-send-report', sendResult.success);
    return NextResponse.json({ 
      success: true, 
      message: `Report sent successfully to ${sendResult.success}/${sendResult.total} recipients`,
      preview: message,
      recipients: sendResult.results
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("send WhatsApp report", error),
      { status: 500 }
    );
  }
}

// GET endpoint for cron job (scheduled at 7 PM daily)
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "your-secret-key-here";
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    logRouteStart('whatsapp-send-report-cron', {});

    // Get today's report
    const reportData = await getOutletRegionReport(new Date());

    // Format message
    const message = formatReportMessage(reportData, new Date());

    // Send WhatsApp message to multiple numbers
    const sendResult = await sendWhatsAppToMultipleNumbers(message);

    if (sendResult.success === 0) {
      return NextResponse.json(
        { error: "Failed to send WhatsApp message to all recipients" },
        { status: 500 }
      );
    }

    logRouteComplete('whatsapp-send-report-cron', sendResult.success);
    return NextResponse.json({ 
      success: true, 
      message: `Report sent successfully via cron to ${sendResult.success}/${sendResult.total} recipients`,
      recipients: sendResult.results
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("send WhatsApp report via cron", error),
      { status: 500 }
    );
  }
}

