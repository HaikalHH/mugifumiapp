import { formatMidtransOrderId } from "../../../lib/midtrans";
import { MidtransResultCard } from "../_components/midtrans-result-card";

type SearchParams = {
  order_id?: string | string[];
  gross_amount?: string | string[];
};

const toStringValue = (value?: string | string[]) => (typeof value === "string" ? value : undefined);

export default async function MidtransPendingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const orderId = toStringValue(params?.order_id);
  const grossAmount = toStringValue(params?.gross_amount);
  const displayOrderId = formatMidtransOrderId(orderId);
  const whatsappMessage = `Halo Kak, saya belum menyelesaikan pembayaran untuk order ${
    displayOrderId ? `#${displayOrderId}` : ""
  }. Mohon bantuannya untuk proses pembayaran.`;

  return (
    <MidtransResultCard
      variant="pending"
      title="Pembayaran Belum Selesai"
      description="Sepertinya kamu menutup halaman sebelum proses pembayaran selesai. Tidak apa-apa, kamu bisa lanjutkan sebelum waktu habis."
      orderId={orderId}
      grossAmount={grossAmount}
      whatsappMessage={whatsappMessage}
    >
      <ul className="list-disc space-y-1 pl-5">
        <li>Buka kembali tautan pembayaran di WhatsApp untuk melanjutkan.</li>
        <li>Jika sudah transfer tapi masih pending, kirimkan bukti pembayaran ke admin melalui tombol di bawah.</li>
      </ul>
    </MidtransResultCard>
  );
}
