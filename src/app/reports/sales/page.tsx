"use client";
import { useCallback, useEffect, useState } from "react";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { DateTimePicker } from "../../../components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useAuth } from "../../providers";
import { getStartOfDayJakarta, getEndOfDayJakarta } from "../../../lib/timezone";

export default function ReportsSalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any>(null);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs: string[] = [];
    if (from) qs.push(`from=${encodeURIComponent(getStartOfDayJakarta(from).toISOString())}`);
    if (to) qs.push(`to=${encodeURIComponent(getEndOfDayJakarta(to).toISOString())}`);
    const query = qs.length ? `?${qs.join("&")}` : "";
    const data = await fetch(`/api/reports/sales${query}`).then((r) => r.json());
    setSales(data);
  }, [from, to]);

  const sendWhatsAppReport = async () => {
    try {
      setSendingWhatsApp(true);
      setWhatsappMessage(null);
      const response = await fetch("/api/whatsapp/send-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: new Date().toISOString() }) });
      const data = await response.json();
      setWhatsappMessage(response.ok ? "✅ Report berhasil dikirim ke WhatsApp!" : "❌ Gagal mengirim report: " + (data.error || "Unknown error"));
      setTimeout(() => setWhatsappMessage(null), 5000);
    } catch {
      setWhatsappMessage("❌ Error mengirim report ke WhatsApp");
      setTimeout(() => setWhatsappMessage(null), 5000);
    } finally {
      setSendingWhatsApp(false);
    }
  };

  useEffect(() => { if (user?.role === "Admin" || user?.role === "Manager") load(); }, [load, user]);

  if (user?.role !== "Admin" && user?.role !== "Manager") {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reports · Revenue</h1>
        <div className="flex items-center gap-3">
          {whatsappMessage && <div className="text-sm px-3 py-1 rounded bg-blue-50 text-blue-700">{whatsappMessage}</div>}
          <Button onClick={sendWhatsAppReport} disabled={sendingWhatsApp} variant="outline">{sendingWhatsApp ? "Mengirim..." : "Kirim ke WhatsApp"}</Button>
        </div>
      </div>

      <section>
        <h2 className="font-medium mb-2">Periode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <Label>From</Label>
            <DateTimePicker value={from} onChange={setFrom} placeholder="Select start date" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>To</Label>
            <DateTimePicker value={to} onChange={setTo} placeholder="Select end date" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">Revenue Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 border rounded p-4">
            <div className="font-medium text-sm text-muted-foreground">Actual Total</div>
            <div className="text-2xl font-semibold">{sales ? sales.totalActual.toLocaleString("id-ID") : 0}</div>
            <div className="text-sm text-muted-foreground">Rata-rata potongan %: {sales && sales.avgPotonganPct != null ? `${sales.avgPotonganPct}%` : "-"}</div>
          </div>
          <div className="space-y-2 border rounded p-4">
            <div className="font-medium text-sm text-muted-foreground">Transactions</div>
            <div className="text-2xl font-semibold">{sales && sales.sales ? sales.sales.length.toLocaleString("id-ID") : 0}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">Outlet + Region</h2>
        {sales && sales.byOutletRegion && Object.keys(sales.byOutletRegion).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Outlet + Region</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Actual (Rp)</TableHead>
                <TableHead className="text-right">Potongan %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(sales.byOutletRegion).map(([k, v]: any) => (
                <TableRow key={k}>
                  <TableCell>{k}</TableCell>
                  <TableCell className="text-right">{v.count}</TableCell>
                  <TableCell className="text-right">{(v.actual ?? 0).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right">{v.potonganPct != null ? `${v.potonganPct}%` : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-sm text-muted-foreground">Tidak ada data.</div>
        )}
      </section>

      {/* Outlet Share (%) */}
      <section>
        <h2 className="font-medium mb-2">Outlet Share (%)</h2>
        {sales && sales.byOutlet && Object.keys(sales.byOutlet).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(sales.byOutlet).map(([name, v]: any) => (
              <div key={name} className="flex items-center justify-between">
                <span>{name}</span>
                <span className="tabular-nums">
                  {sales.totalActual > 0 ? `${Math.round((((v as any).actual || 0) / sales.totalActual) * 1000) / 10}%` : "-"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Tidak ada data.</div>
        )}
      </section>

    </main>
  );
}
