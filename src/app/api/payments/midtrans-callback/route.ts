import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { verifyMidtransSignature } from "../../../../lib/midtrans";
import { calculateNetPayout, deriveMidtransMethod, MidtransPaymentPayload } from "../../../../lib/midtrans-fees";

function parseNumericField(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return Math.round(parsed);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as MidtransPaymentPayload;
    const {
      order_id,
      transaction_status,
      status_code,
      gross_amount,
      signature_key,
      transaction_id,
    } = payload;

    logRouteStart("midtrans-callback", { order_id, transaction_status });

    if (!order_id || !transaction_status || !status_code || !gross_amount || !signature_key) {
      return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
    }

    const signatureValid = verifyMidtransSignature({
      orderId: String(order_id),
      statusCode: String(status_code),
      grossAmount: String(gross_amount),
      signatureKey: String(signature_key),
    });

    if (!signatureValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const order = await withRetry(async () => {
      return prisma.order.findFirst({
        where: { midtransOrderId: String(order_id) },
        select: {
          id: true,
          totalAmount: true,
        },
      });
    }, 2, "midtrans-callback-find-order");

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const statusLower = String(transaction_status).toLowerCase();
    const paidAmount = Math.round(Number(gross_amount) || 0);
    const method = deriveMidtransMethod(payload);
    const { net: netPayout } = calculateNetPayout(paidAmount, method);
    const settlementAmount =
      parseNumericField(payload.settlement_amount) ??
      parseNumericField(payload.settlementAmount);
    const merchantFee =
      parseNumericField(payload.merchant_fee) ??
      parseNumericField(payload.merchantFee) ??
      parseNumericField(payload.fee_amount) ??
      parseNumericField(payload.feeAmount);
    const netFromPayload =
      (settlementAmount && settlementAmount > 0 ? settlementAmount : null) ??
      (merchantFee && merchantFee > 0 ? Math.max(0, paidAmount - merchantFee) : null);
    const actPayoutAmount =
      (netFromPayload && netFromPayload > 0 ? netFromPayload : null) ??
      (netPayout > 0 ? netPayout : (paidAmount > 0 ? paidAmount : order.totalAmount));

    if (statusLower === "capture" || statusLower === "settlement") {
      await withRetry(async () => {
        return prisma.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            midtransTransactionId: transaction_id ? String(transaction_id) : null,
            actPayout: actPayoutAmount,
          },
        });
      }, 2, "midtrans-callback-paid");

      logRouteComplete("midtrans-callback");
      return NextResponse.json({ success: true });
    }

    if (statusLower === "expire" || statusLower === "cancel") {
      await withRetry(async () => {
        return prisma.$transaction(async (tx) => {
          await tx.orderItem.deleteMany({ where: { orderId: order.id } });
          await tx.delivery.deleteMany({ where: { orderId: order.id } });
          await tx.order.delete({ where: { id: order.id } });
        });
      }, 2, "midtrans-callback-expire");

      logRouteComplete("midtrans-callback");
      return NextResponse.json({ success: true, deleted: true });
    }

    if (statusLower === "pending") {
      await withRetry(async () => {
        return prisma.order.update({
          where: { id: order.id },
          data: {},
        });
      }, 2, "midtrans-callback-pending");

      logRouteComplete("midtrans-callback");
      return NextResponse.json({ success: true });
    }

    logRouteComplete("midtrans-callback");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("process midtrans callback", error),
      { status: 500 },
    );
  }
}
