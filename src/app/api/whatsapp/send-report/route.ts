import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { sendGreenGroupMessage } from "../../../../lib/greenapi";

// Sales report will be sent to a WhatsApp group via Green API
const SALES_REPORT_GROUP_ID = process.env.GREENAPI_SALES_GROUP_ID || ""; // e.g. 6281275167471-1555838526

interface OutletRegionData {
  count: number;
  actual: number;
  potonganPct: number | null;
  ongkirPotongan: number;
}

async function sendSalesReportToGroup(message: string) {
  if (!SALES_REPORT_GROUP_ID) {
    return { ok: false, error: "GREENAPI_SALES_GROUP_ID not set" } as const;
  }
  const ok = await sendGreenGroupMessage(SALES_REPORT_GROUP_ID, message);
  return { ok } as const;
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
    const isWhatsApp = order.outlet.toLowerCase() === "whatsapp";
    
    // Calculate subtotal from order items
    const preDiscountSubtotal = orderItems.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);
    const discountPct = needsDiscount(order.outlet) && typeof order.discount === "number" ? order.discount : 0;
    const discountedSubtotal = Math.round(preDiscountSubtotal * (1 - (discountPct || 0) / 100));

    // Calculate ongkir potongan from deliveries (only for WhatsApp outlet)
    let ongkirPotongan = 0;
    if (isWhatsApp && order.deliveries && order.deliveries.length > 0) {
      for (const delivery of order.deliveries) {
        if (delivery.ongkirPlan && delivery.ongkirActual && delivery.status === "delivered") {
          const ongkirDifference = delivery.ongkirActual - delivery.ongkirPlan;
          if (ongkirDifference > 0) {
            ongkirPotongan += ongkirDifference;
          }
        }
      }
    }

    const resolvedActual = order.actPayout != null
      ? order.actPayout
      : (order.totalAmount != null ? order.totalAmount : discountedSubtotal);

    // For orders, actual received is actPayout if available, otherwise totalAmount
    // For Free outlet, set to 0
    // For Cafe outlet, if no actPayout, set to 0
    const actual = isFree
      ? 0
      : (isCafe
        ? (order.actPayout ?? 0)
        : (isWhatsApp
          ? (resolvedActual != null ? Math.max(0, resolvedActual - ongkirPotongan) : null)
          : resolvedActual));

    // Potongan calculation for orders (include ongkir potongan)
    const potongan = isFree
      ? preDiscountSubtotal + ongkirPotongan
      : (isCafe
        ? (preDiscountSubtotal - (actual ?? 0))
        : (actual != null ? (preDiscountSubtotal - actual) : null));

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

    // Send WhatsApp message to the configured group via Green API
    const sendResult = await sendSalesReportToGroup(message);
    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.error || "Failed to send WhatsApp group message" },
        { status: 500 }
      );
    }

    logRouteComplete('whatsapp-send-report', 1);
    return NextResponse.json({ 
      success: true, 
      message: `Report sent to WhatsApp group`,
      preview: message
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
    // Allow either Vercel Scheduled Function (x-vercel-cron) or custom Authorization bearer
    const isVercelCron = req.headers.has("x-vercel-cron");
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET || "";
    if (!isVercelCron && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logRouteStart('whatsapp-send-report-cron', {});

    // Get today's report
    const reportData = await getOutletRegionReport(new Date());

    // Format message
    const message = formatReportMessage(reportData, new Date());

    const sendResult = await sendSalesReportToGroup(message);
    if (!sendResult.ok) {
      return NextResponse.json(
        { error: sendResult.error || "Failed to send WhatsApp group message" },
        { status: 500 }
      );
    }

    logRouteComplete('whatsapp-send-report-cron', 1);
    return NextResponse.json({ 
      success: true, 
      message: `Report sent successfully via cron to group`
    });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("send WhatsApp report via cron", error),
      { status: 500 }
    );
  }
}
