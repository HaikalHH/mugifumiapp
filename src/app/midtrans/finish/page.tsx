import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { MidtransResultCard } from "../_components/midtrans-result-card";

type SearchParams = {
  order_id?: string | string[];
  gross_amount?: string | string[];
  transaction_status?: string | string[];
  status_code?: string | string[];
};

function toStringValue(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
}

async function resolveGrossAmount(orderId?: string, grossAmount?: string) {
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
    console.error("Failed to resolve midtrans finish gross amount:", error);
  }

  return grossAmount;
}

function buildQuery(orderId?: string, grossAmount?: string) {
  const params = new URLSearchParams();
  if (orderId) params.set("order_id", orderId);
  if (grossAmount) params.set("gross_amount", grossAmount);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export default async function MidtransFinishPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const orderId = toStringValue(params?.order_id);
  const grossAmountParam = toStringValue(params?.gross_amount);
  const grossAmount = await resolveGrossAmount(orderId, grossAmountParam);
  const transactionStatus = toStringValue(params?.transaction_status)?.toLowerCase();
  const statusCode = toStringValue(params?.status_code);

  const pending =
    transactionStatus === "pending" ||
    transactionStatus === "challenge" ||
    (!transactionStatus && statusCode === "201");
  if (pending) {
    redirect(`/midtrans/pending${buildQuery(orderId, grossAmount)}`);
  }

  const errored =
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "expire" ||
    transactionStatus === "failure" ||
    transactionStatus === "error" ||
    (!transactionStatus && statusCode && statusCode !== "200");
  if (errored) {
    redirect(`/midtrans/error${buildQuery(orderId, grossAmount)}`);
  }

  const whatsappMessage = `Halo Kak, saya sudah menyelesaikan pembayaran untuk order ${orderId ? `#${orderId}` : ""}. Mohon dibantu prosesnya ya 🙏`;

  return (
    <MidtransResultCard
      variant="success"
      title="Pembayaran Berhasil"
      description="Terima kasih! Pembayaran kamu sudah kami terima. Tim Mugifumi akan segera memproses order sesuai jadwal pengiriman."
      orderId={orderId}
      grossAmount={grossAmount}
      whatsappMessage={whatsappMessage}
    >
      <p>
        Jika kamu belum menerima konfirmasi dalam waktu 10 menit, silakan hubungi admin menggunakan tombol di bawah agar
        tim kami bisa memeriksa status pembayaranmu.
      </p>
    </MidtransResultCard>
  );
}
