import crypto from "crypto";
import { prisma } from "./prisma";

type SnapItem = {
  id: string;
  price: number;
  quantity: number;
  name: string;
};

type SnapCreateParams = {
  orderId: string;
  grossAmount: number;
  customer?: string | null;
  items: SnapItem[];
  expiryMinutes?: number;
};

function resolveAppBaseUrl() {
  const candidates = [
    process.env.MIDTRANS_APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_BASE_URL,
  ];
  for (const value of candidates) {
    if (value && value.trim()) {
      return value.trim().replace(/\/+$/, "");
    }
  }
  return "";
}

function resolveCallbackUrl(envValue?: string, fallbackPath?: string) {
  if (envValue && envValue.trim()) {
    return envValue.trim();
  }
  const appBase = resolveAppBaseUrl();
  if (appBase && fallbackPath) {
    return `${appBase}${fallbackPath}`;
  }
  return undefined;
}

function getMidtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is not set");
  }

  // Default to production as requested; allow override via env for testing
  const baseUrl = (process.env.MIDTRANS_BASE_URL || "https://app.midtrans.com").replace(/\/+$/, "");
  const finishUrl = resolveCallbackUrl(process.env.MIDTRANS_FINISH_URL, "/midtrans/finish");
  const pendingUrl = resolveCallbackUrl(process.env.MIDTRANS_PENDING_URL, "/midtrans/pending");
  const errorUrl = resolveCallbackUrl(process.env.MIDTRANS_ERROR_URL, "/midtrans/error");
  return { serverKey, baseUrl, finishUrl, pendingUrl, errorUrl };
}

function getEnabledPayments(): string[] | undefined {
  const raw = process.env.MIDTRANS_ENABLED_PAYMENTS;
  if (!raw || !raw.trim()) return undefined;

  const clean = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const fromJson = parsed.map((entry) => clean(entry)).filter((v): v is string => Boolean(v));
      if (fromJson.length > 0) {
        return fromJson;
      }
    }
  } catch {
    // fall through to comma parsing
  }

  const fromComma = raw.split(",").map((entry) => clean(entry)).filter((v): v is string => Boolean(v));
  if (fromComma.length === 0) return undefined;
  const seen = new Set<string>();
  return fromComma.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export async function createSnapTransaction(params: SnapCreateParams) {
  const { serverKey, baseUrl, finishUrl, pendingUrl, errorUrl } = getMidtransConfig();
  const expiryMinutes = params.expiryMinutes ?? 60;
  const enabledPayments = getEnabledPayments();
  const includesPayment = (code: string) => {
    if (!enabledPayments) return true;
    return enabledPayments.includes(code);
  };
  const snapCallbackUrl = process.env.MIDTRANS_GOPAY_CALLBACK_URL || finishUrl || pendingUrl || errorUrl || undefined;

  const body = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.grossAmount,
    },
    callbacks:
      finishUrl || pendingUrl || errorUrl
        ? {
            ...(finishUrl ? { finish: finishUrl } : {}),
            ...(pendingUrl ? { unfinish: pendingUrl } : {}),
            ...(errorUrl ? { error: errorUrl } : {}),
          }
        : undefined,
    customer_details: {
      first_name: params.customer || "Customer",
    },
    item_details: params.items.map((item) => ({
      id: item.id,
      price: item.price,
      quantity: item.quantity,
      name: item.name.substring(0, 50), // Snap requires <=50 chars
    })),
    enabled_payments: enabledPayments,
    payment_option_priorities: enabledPayments,
    ...(includesPayment("gopay")
      ? {
          gopay: {
            enable_callback: Boolean(snapCallbackUrl),
            callback_url: snapCallbackUrl,
          },
        }
      : {}),
    expiry: {
      unit: "minutes",
      duration: expiryMinutes,
    },
  };

  const authHeader = Buffer.from(`${serverKey}:`).toString("base64");
  const res = await fetch(`${baseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Midtrans Snap error: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  return {
    token: data?.token as string,
    redirectUrl: data?.redirect_url as string,
    expiryAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
    orderId: params.orderId,
  };
}

export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}) {
  const { serverKey } = getMidtransConfig();
  const payload = `${input.orderId}${input.statusCode}${input.grossAmount}${serverKey}`;
  const hash = crypto.createHash("sha512").update(payload).digest("hex");
  return hash === input.signatureKey;
}

export function formatMidtransOrderId(orderId?: string | null) {
  if (!orderId) return undefined;
  const trimmed = orderId.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split("-");
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    if (/^\d{6,}$/.test(last)) {
      return parts.slice(0, parts.length - 1).join("-");
    }
  }
  return trimmed;
}

export async function resolveMidtransGrossAmount(orderId?: string, grossAmount?: string) {
  if (grossAmount && Number.isFinite(Number(grossAmount))) {
    return grossAmount;
  }

  if (!orderId) {
    return grossAmount;
  }

  try {
    const order = await prisma.order.findFirst({
      where: { midtransOrderId: orderId },
      select: { totalAmount: true },
    });

    if (order?.totalAmount != null) {
      return String(order.totalAmount);
    }
  } catch (error) {
    console.error("Failed to resolve Midtrans gross amount:", error);
  }

  return grossAmount;
}
