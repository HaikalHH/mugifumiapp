"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

function formatCurrency(amount: number) {
  return `Rp ${Number(amount || 0).toLocaleString("id-ID")}`;
}

type DebtSummaryRow = {
  periodId: number;
  weekId: number | null;
  weekName: string;
  startDate: string;
  endDate: string;
  totalActual: number;
  totalOmsetPaid: number;
  pinjamModal: number;
  totalPaid: number;
  remaining: number;
};

type DebtSummaryResponse = {
  totalRemaining: number;
  rows: DebtSummaryRow[];
};

type PeriodDebtDetail = {
  period: {
    id: number;
    name: string;
    weekId: number | null;
    week: { id: number; name: string; startDate: string; endDate: string } | null;
    startDate: string;
    endDate: string;
  };
  totals: {
    totalActual: number;
    totalOmsetPaid: number;
    pinjamModal: number;
    totalPaid: number;
    remaining: number;
  };
  payments: Array<{ id: number; term: number; amount: number; note: string | null; createdAt: string }>;
};

export default function FinanceDebtPage() {
  const [summary, setSummary] = useState<DebtSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PeriodDebtDetail | null>(null);
  const [addingAmount, setAddingAmount] = useState("");
  const [addingNote, setAddingNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/debt");
      if (!res.ok) throw new Error("Failed to load debt summary");
      const data: DebtSummaryResponse = await res.json();
      setSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (periodId: number) => {
    setActivePeriodId(periodId);
    try {
      const res = await fetch(`/api/finance/debt?periodId=${periodId}`);
      if (!res.ok) throw new Error("Failed to load debt detail");
      const data: PeriodDebtDetail = await res.json();
      setDetail(data);
      setAddingAmount("");
      setAddingNote("");
    } catch (e) {
      console.error(e);
    }
  };

  const addPayment = async () => {
    if (!activePeriodId) return;
    if (!addingAmount.trim()) {
      alert("Masukkan nominal pembayaran");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { periodId: activePeriodId, amount: Math.round(Number(addingAmount || 0)), note: addingNote || undefined };
      const res = await fetch("/api/finance/debt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Gagal menyimpan pembayaran hutang");
      await openDetail(activePeriodId);
      await loadSummary();
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan pembayaran hutang");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const totalRemaining = summary?.totalRemaining ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Debt</h1>
        {loading && <span className="text-sm text-gray-500">Loading...</span>}
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Total Utang Tersisa</Label>
          <div className="text-lg font-semibold">{formatCurrency(totalRemaining)}</div>
        </div>
      </section>

      <section className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Minggu</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Omset PAID</TableHead>
              <TableHead className="text-right">Pinjam Modal</TableHead>
              <TableHead className="text-right">Sudah Dibayar</TableHead>
              <TableHead className="text-right">Sisa</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(summary?.rows || []).map((row) => (
              <TableRow key={row.periodId}>
                <TableCell className="font-medium">{row.weekName}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalActual)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalOmsetPaid)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.pinjamModal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.totalPaid)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(row.remaining)}</TableCell>
                <TableCell className="text-center">
                  <Button size="sm" onClick={() => openDetail(row.periodId)}>Kelola</Button>
                </TableCell>
              </TableRow>
            ))}
            {(!summary || summary.rows.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-gray-500">Tidak ada data minggu</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {activePeriodId && detail && (
        <Dialog open onOpenChange={(open) => { if (!open) { setActivePeriodId(null); setDetail(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Hutang Minggu {detail.period.week?.name || detail.period.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Pinjam Modal (Actual - PAID)</div>
                  <div className="font-semibold">{formatCurrency(detail.totals.pinjamModal)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Sisa</div>
                  <div className="font-semibold">{formatCurrency(detail.totals.remaining)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Actual</div>
                  <div className="font-semibold">{formatCurrency(detail.totals.totalActual)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Omset PAID</div>
                  <div className="font-semibold">{formatCurrency(detail.totals.totalOmsetPaid)}</div>
                </div>
              </div>
              <div>
                <div className="font-medium mb-1 text-sm">Term Pembayaran</div>
                <div className="space-y-2 max-h-52 overflow-auto">
                  {detail.payments.length === 0 && (
                    <div className="text-sm text-gray-500">Belum ada pembayaran</div>
                  )}
                  {detail.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between border rounded p-2 text-sm">
                      <div className="font-medium">Term {p.term}</div>
                      <div className="flex items-center gap-3">
                        <div>{formatCurrency(p.amount)}</div>
                        {p.note && <div className="text-gray-500">{p.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tambah Pembayaran</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" value={addingAmount} onChange={(e) => setAddingAmount(e.target.value)} placeholder="Rp" />
                  <Input value={addingNote} onChange={(e) => setAddingNote(e.target.value)} placeholder="Catatan (opsional)" />
                  <Button onClick={addPayment} disabled={submitting}>Submit</Button>
                </div>
                <div className="text-xs text-gray-500">Setiap submit akan otomatis menjadi Term {detail.payments.length + 1}.</div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setActivePeriodId(null); setDetail(null); }}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
