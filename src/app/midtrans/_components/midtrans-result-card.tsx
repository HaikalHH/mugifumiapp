import { ReactNode } from "react";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/button";

type ResultVariant = "success" | "pending" | "error";

const VARIANT_CONFIG: Record<
  ResultVariant,
  { icon: typeof CheckCircle2; accent: string; badge: string; label: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
    label: "Pembayaran Berhasil",
  },
  pending: {
    icon: Clock,
    accent: "text-amber-600",
    badge: "bg-amber-50 text-amber-700",
    label: "Menunggu Pembayaran",
  },
  error: {
    icon: AlertTriangle,
    accent: "text-red-600",
    badge: "bg-red-50 text-red-700",
    label: "Pembayaran Bermasalah",
  },
};

type MidtransResultCardProps = {
  variant: ResultVariant;
  title: string;
  description: string;
  whatsappMessage: string;
  orderId?: string;
  grossAmount?: string;
  children?: ReactNode;
};

const WHATSAPP_PHONE = (process.env.NEXT_PUBLIC_WHATSAPP_ORDER_PHONE || "6281320718117").replace(/^\+/, "");

function formatCurrency(amount?: string) {
  if (!amount) return "-";
  const number = Number(amount);
  if (!Number.isFinite(number)) return "-";
  return `Rp ${number.toLocaleString("id-ID")}`;
}

export function MidtransResultCard({
  variant,
  title,
  description,
  whatsappMessage,
  orderId,
  grossAmount,
  children,
}: MidtransResultCardProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  const whatsAppUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className={`rounded-full bg-slate-100 p-2 ${config.accent}`}>
            <Icon className="size-6" aria-hidden />
          </div>
          <div>
            <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.badge}`}>
              {config.label}
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
        </div>

        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Order ID</p>
            <p className="text-lg font-semibold text-slate-900">{orderId || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Total Pembayaran</p>
            <p className="text-lg font-semibold text-slate-900">{formatCurrency(grossAmount)}</p>
          </div>
        </div>

        {children && <div className="text-sm text-slate-600">{children}</div>}

        <div className="space-y-2 rounded-xl border border-slate-200 p-4">
          <p className="text-sm text-slate-700">
            Jika membutuhkan bantuan, hubungi admin kami di WhatsApp melalui tombol berikut:
          </p>
          <Button asChild className="w-full sm:w-auto">
            <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer">
              Chat WhatsApp Admin
            </a>
          </Button>
          <p className="text-xs text-slate-500">
            Nomor WhatsApp: +{WHATSAPP_PHONE.replace(/^62/, "62 ")}
          </p>
        </div>

        <p className="text-xs text-slate-400">
          Halaman ini disediakan untuk memastikan Anda dapat menghubungi admin tanpa pesan otomatis dengan teks yang salah.
        </p>
      </div>
    </main>
  );
}
