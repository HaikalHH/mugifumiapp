import { formatMidtransOrderId } from "../../../lib/midtrans";
import { MidtransResultCard } from "../_components/midtrans-result-card";

type SearchParams = {
  order_id?: string | string[];
  gross_amount?: string | string[];
};

const toStringValue = (value?: string | string[]) => (typeof value === "string" ? value : undefined);

export default async function MidtransErrorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const orderId = toStringValue(params?.order_id);
  const grossAmount = toStringValue(params?.gross_amount);
  const displayOrderId = formatMidtransOrderId(orderId);
  const whatsappMessage = `Halo Kak, pembayaran untuk order ${
    displayOrderId ? `#${displayOrderId}` : ""
  } mengalami kendala. Mohon bantuannya ya 🙏`;

  return (
    <MidtransResultCard
      variant="error"
      title="Pembayaran Mengalami Kendala"
      description="Midtrans melaporkan adanya error pada transaksi kamu. Jangan khawatir, tim kami siap membantu."
      orderId={orderId}
      grossAmount={grossAmount}
      whatsappMessage={whatsappMessage}
    >
      <p>
        Silakan coba ulang beberapa menit lagi atau hubungi admin melalui WhatsApp untuk pengecekan manual. Jika kamu
        sudah melakukan transfer, sertakan bukti transaksi agar tim kami bisa segera menindaklanjuti.
      </p>
    </MidtransResultCard>
  );
}
