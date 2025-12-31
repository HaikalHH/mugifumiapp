"use client";
import { useCallback, useEffect, useState } from "react";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { DateTimePicker } from "../../../components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useAuth, hasRole } from "../../providers";
import { getStartOfDayJakarta, getEndOfDayJakarta } from "../../../lib/timezone";

export default function ReportsSalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<any>(null);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [filterType, setFilterType] = useState<"all" | "retail" | "b2b">("all");
  const [b2bPage, setB2bPage] = useState(1);
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

  useEffect(() => {
    if (hasRole(user, "Admin") || hasRole(user, "Manager")) {
      load();
    }
  }, [load, user]);
  useEffect(() => { setB2bPage(1); }, [filterType, sales, from, to]);

  if (!hasRole(user, "Admin") && !hasRole(user, "Manager")) {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  const filteredSales = (() => {
    const rows = (sales?.sales || []) as any[];
    if (filterType === "b2b") return rows.filter((r) => r.source === "B2B");
    if (filterType === "retail") return rows.filter((r) => r.source !== "B2B");
    return rows;
  })();
  const b2bRows = filteredSales.filter((r: any) => r.source === "B2B");
  const B2B_PAGE_SIZE = 5;
  const b2bPageCount = Math.max(1, Math.ceil(b2bRows.length / B2B_PAGE_SIZE));
  const pagedB2BRows = b2bRows.slice((b2bPage - 1) * B2B_PAGE_SIZE, b2bPage * B2B_PAGE_SIZE);

  const aggregates = (() => {
    const byOutlet: Record<string, { count: number; actual: number; original: number; potongan: number; midtransFee: number }> = {};
    const byOutletRegion: Record<string, { count: number; actual: number; original: number; potongan: number; midtransFee: number }> = {};
    let totalActual = 0;
    let totalOriginal = 0;
    let totalPotongan = 0;

    const retailRows = filteredSales.filter((r) => r.source !== "B2B");

    for (const row of filteredSales) {
      const actual = row.actualReceived || 0;
      const original = row.originalBeforeDiscount || 0;
      const pot = row.potongan || 0;
      totalActual += actual;
      totalOriginal += original;
      totalPotongan += pot;
    }

    for (const row of retailRows) {
      const actual = row.actualReceived || 0;
      const original = row.originalBeforeDiscount || 0;
      const pot = row.potongan || 0;
      const fee = row.midtransFee || 0;

      byOutlet[row.outlet] ||= { count: 0, actual: 0, original: 0, potongan: 0, midtransFee: 0 };
      byOutlet[row.outlet].count += 1;
      byOutlet[row.outlet].actual += actual;
      byOutlet[row.outlet].original += original;
      byOutlet[row.outlet].potongan += pot;
      byOutlet[row.outlet].midtransFee += fee;

      const regionKey = `${row.outlet} ${row.location || ""}`.trim();
      byOutletRegion[regionKey] ||= { count: 0, actual: 0, original: 0, potongan: 0, midtransFee: 0 };
      byOutletRegion[regionKey].count += 1;
      byOutletRegion[regionKey].actual += actual;
      byOutletRegion[regionKey].original += original;
      byOutletRegion[regionKey].potongan += pot;
      byOutletRegion[regionKey].midtransFee += fee;
    }

    const avgPotonganPct = totalOriginal > 0 ? Math.round(((totalPotongan / totalOriginal) * 100) * 10) / 10 : null;
    const finalRegions = Object.fromEntries(
      Object.entries(byOutletRegion).map(([key, value]) => {
        const potonganPct = value.original > 0 ? Math.round(((value.potongan / value.original) * 100) * 10) / 10 : null;
        const gross = value.actual + value.midtransFee;
        const feePct = gross > 0 ? Math.round(((value.midtransFee / gross) * 1000)) / 10 : null;
        return [
          key,
          {
            count: value.count,
            actual: value.actual,
            potonganPct,
            midtransFee: value.midtransFee,
            midtransFeePct: feePct,
          },
        ];
      })
    );

    return { byOutlet, byOutletRegion: finalRegions, totalActual, avgPotonganPct, transactions: filteredSales.length, retailRows };
  })();

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
        <h2 className="font-medium mb-2">Filter</h2>
        <div className="flex gap-3 items-center">
          <Label className="text-sm">Tampilkan</Label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua (Retail + B2B)</SelectItem>
              <SelectItem value="retail">Retail saja</SelectItem>
              <SelectItem value="b2b">B2B saja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">Revenue Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 border rounded p-4">
            <div className="font-medium text-sm text-muted-foreground">Actual Total</div>
            <div className="text-2xl font-semibold">{aggregates.totalActual.toLocaleString("id-ID")}</div>
            <div className="text-sm text-muted-foreground">Rata-rata potongan %: {aggregates.avgPotonganPct != null ? `${aggregates.avgPotonganPct}%` : "-"}</div>
          </div>
          <div className="space-y-2 border rounded p-4">
            <div className="font-medium text-sm text-muted-foreground">Transactions</div>
            <div className="text-2xl font-semibold">{aggregates.transactions.toLocaleString("id-ID")}</div>
          </div>
        </div>
      </section>

      {/* B2B Orders (Wholesale/Cafe from B2B table) */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">Orders B2B (Wholesale/Cafe)</h2>
          <div className="text-sm text-gray-600">
            Total actual: Rp {(() => {
              const rows = filteredSales.filter((s: any) => s.source === "B2B");
              const total = rows.reduce((acc: number, r: any) => acc + (r.actualReceived || 0), 0);
              return total.toLocaleString("id-ID");
            })()}
          </div>
        </div>
        {filteredSales.some((s: any) => s.source === "B2B") ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total (Rp)</TableHead>
                <TableHead className="text-right">Actual (Rp)</TableHead>
                <TableHead className="text-center">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedB2BRows.map((row) => (
                <TableRow key={`b2b-${row.id}`}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.outlet}</TableCell>
                  <TableCell>{row.customer || "-"}</TableCell>
                  <TableCell>{row.location || "-"}</TableCell>
                  <TableCell>{row.orderDate ? new Date(row.orderDate).toLocaleDateString("id-ID") : "-"}</TableCell>
                  <TableCell className="text-right">{(row.total || 0).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right">{(row.actualReceived || 0).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-center">{row.itemsCount || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-sm text-muted-foreground">Tidak ada data B2B pada periode ini.</div>
        )}
        {b2bRows.length > B2B_PAGE_SIZE && (
          <div className="flex items-center justify-end gap-3 mt-3">
            <div className="text-sm text-gray-600">
              Page {b2bPage} / {b2bPageCount}
            </div>
            <Button variant="outline" size="sm" disabled={b2bPage <= 1} onClick={() => setB2bPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={b2bPage >= b2bPageCount} onClick={() => setB2bPage((p) => Math.min(b2bPageCount, p + 1))}>
              Next
            </Button>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Outlet + Region</h2>
        {Object.keys(aggregates.byOutletRegion).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Outlet + Region</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Actual (Rp)</TableHead>
              <TableHead className="text-right">Potongan %</TableHead>
              <TableHead className="text-right">Midtrans Fee (Rp)</TableHead>
              <TableHead className="text-right">Fee %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(aggregates.byOutletRegion).map(([k, v]: any) => (
              <TableRow key={k}>
                <TableCell>{k}</TableCell>
                <TableCell className="text-right">{v.count}</TableCell>
                <TableCell className="text-right">{(v.actual ?? 0).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right">{v.potonganPct != null ? `${v.potonganPct}%` : "-"}</TableCell>
                <TableCell className="text-right">{(v.midtransFee ?? 0).toLocaleString("id-ID")}</TableCell>
                <TableCell className="text-right">{v.midtransFeePct != null ? `${v.midtransFeePct}%` : "-"}</TableCell>
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
        {Object.keys(aggregates.byOutlet).length > 0 ? (
          <div className="space-y-2">
            {(() => {
              const totalRetailActual = Object.values(aggregates.byOutlet).reduce((acc: number, v: any) => acc + (v.actual || 0), 0);
              return Object.entries(aggregates.byOutlet).map(([name, v]: any) => (
                <div key={name} className="flex items-center justify-between">
                  <span>{name}</span>
                  <span className="tabular-nums">
                    {totalRetailActual > 0 ? `${Math.round((((v as any).actual || 0) / totalRetailActual) * 1000) / 10}%` : "-"}
                  </span>
                </div>
              ));
            })()}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Tidak ada data.</div>
        )}
      </section>

    </main>
  );
}
