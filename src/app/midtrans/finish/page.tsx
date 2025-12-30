import { MidtransResultCard } from "../_components/midtrans-result-card";

type SearchParams = {
  order_id?: string | string[];
  gross_amount?: string | string[];
};

function toStringValue(value?: string | string[]) {
  return typeof value === "string" ? value : undefined;
}

export default async function MidtransFinishPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const orderId = toStringValue(params?.order_id);
  const grossAmount = toStringValue(params?.gross_amount);
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
