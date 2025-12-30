type FeeRule = {
  flat?: number;
  percent?: number;
};

type FeeConfig = Record<string, FeeRule>;

export type MidtransPaymentPayload = {
  payment_type?: string;
  va_numbers?: Array<{ bank?: string | null } | null> | null;
  permata_va_number?: string | null;
  bank?: string | null;
  settlement_amount?: string | number | null;
  settlementAmount?: string | number | null;
  merchant_fee?: string | number | null;
  merchantFee?: string | number | null;
  fee_amount?: string | number | null;
  feeAmount?: string | number | null;
  [key: string]: unknown;
};

const DEFAULT_RULES: FeeConfig = {
  bca_va: { flat: 4000 },
  mandiri_va: { flat: 4000 },
  bni_va: { flat: 4000 },
  bri_va: { flat: 4000 },
  permata_va: { flat: 4000 },
  cimb_va: { flat: 4000 },
  cimb_niaga_va: { flat: 4000 },
  cimbniaga_va: { flat: 4000 },
  gopay: { percent: 0.7 },
  qris: { percent: 0.7 },
};

let cachedRules: FeeConfig | null = null;

function parseRule(raw: unknown): FeeRule | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { flat: Math.round(raw) };
  }
  if (typeof raw === "object") {
    const value = raw as Record<string, unknown>;
    const flat = typeof value.flat === "number" && Number.isFinite(value.flat) ? Math.round(value.flat) : undefined;
    const percent =
      typeof value.percent === "number" && Number.isFinite(value.percent) ? Number(value.percent) : undefined;
    if (flat == null && percent == null) return null;
    return { flat, percent };
  }
  return null;
}

function loadFeeRules(): FeeConfig {
  if (cachedRules) return cachedRules;

  const rawEnv = process.env.MIDTRANS_PAYOUT_FEES;
  if (!rawEnv) {
    cachedRules = { ...DEFAULT_RULES };
    return cachedRules;
  }

  try {
    const parsed = JSON.parse(rawEnv) as Record<string, unknown>;
    const normalized: FeeConfig = { ...DEFAULT_RULES };
    for (const [key, value] of Object.entries(parsed)) {
      const rule = parseRule(value);
      if (rule) {
        normalized[key.toLowerCase()] = rule;
      }
    }
    cachedRules = normalized;
  } catch (err) {
    console.error("Failed to parse MIDTRANS_PAYOUT_FEES env:", err);
    cachedRules = { ...DEFAULT_RULES };
  }
  return cachedRules;
}

export function deriveMidtransMethod(payload: MidtransPaymentPayload): string | null {
  const paymentType = typeof payload.payment_type === "string" ? payload.payment_type.toLowerCase() : null;
  if (!paymentType) return null;

  if (paymentType === "bank_transfer") {
    const vaNumbers = Array.isArray(payload.va_numbers) ? payload.va_numbers : [];
    if (vaNumbers.length > 0) {
      const bank = typeof vaNumbers[0]?.bank === "string" ? vaNumbers[0].bank.toLowerCase() : null;
      if (bank) {
        return `${bank}_va`;
      }
    }
    if (payload.permata_va_number) {
      return "permata_va";
    }
    const bank = typeof payload.bank === "string" ? payload.bank.toLowerCase() : null;
    if (bank) {
      return `${bank}_va`;
    }
  }

  return paymentType;
}

export function calculateNetPayout(paidAmount: number, method: string | null): { net: number; fee: number } {
  const amount = Math.max(0, Math.round(paidAmount));
  if (amount === 0) return { net: 0, fee: 0 };

  const rules = loadFeeRules();
  const methodKey = method ? method.toLowerCase() : null;
  const rule = (methodKey && rules[methodKey]) || rules["default"];
  if (!rule) {
    return { net: amount, fee: 0 };
  }

  let fee = 0;
  if (typeof rule.flat === "number") {
    fee += Math.max(0, Math.round(rule.flat));
  }
  if (typeof rule.percent === "number") {
    fee += Math.max(0, Math.round((rule.percent / 100) * amount));
  }

  const net = Math.max(0, amount - fee);
  return { net, fee };
}
