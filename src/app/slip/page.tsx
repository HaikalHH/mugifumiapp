"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useAuth } from "../providers";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";

type SummaryUser = {
  user: { id: number; name: string; username: string; role: string; baseSalary: number; hourlyRate: number; penaltyRate: number };
  totals: { latenessMinutes: number; workedMinutes: number; overtimeMinutes: number };
  penalty: number;
  manualPenalty?: number;
  manualPenaltyDetails?: Array<{ amount: number; reason: string | null }>;
  overtimePay: number;
  netSalary: number;
  bonus?: number;
};

export default function SlipGajiPage() {
  const { user } = useAuth();
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
  const [year, setYear] = useState<string>(String(currentYear));
  const [month, setMonth] = useState<string>(String(currentMonth));
  const [me, setMe] = useState<SummaryUser | null>(null);
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => Array.from({ length: 5 }).map((_, i) => String(currentYear - i)), [currentYear]);
  const months = useMemo(() => Array.from({ length: 12 }).map((_, i) => String(i + 1)), []);

  type PayrollSummaryRow = {
    user: { id: number; name: string; username: string; role: string; baseSalary: number; hourlyRate: number; penaltyRate: number };
    totals: { latenessMinutes: number; workedMinutes: number; overtimeMinutes: number };
    penalty: number;
    manualPenalty?: number;
    manualPenaltyDetails?: Array<{ amount: number; reason: string | null }>;
    overtimePay: number;
    netSalary: number;
    bonus?: number;
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const monthStr = `${year}-${String(Number(month)).padStart(2, '0')}`;
      const res = await fetch(`/api/payroll/summary?month=${monthStr}`);
      if (!res.ok) throw new Error('failed');
      const data: { users: PayrollSummaryRow[] } = await res.json();
      const row = (data.users || []).find((x) => x.user?.id === user.id) || null;
      setMe(row);
    } catch {
      setMe(null);
    } finally { setLoading(false); }
  }, [user, year, month]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const printPdf = () => {
    if (!me || !user) return;
    const monthLabel = `${String(Number(month)).padStart(2,'0')}/${year}`;
    const manualPenaltyLines = (me.manualPenaltyDetails || []).map((d) => `- Rp ${Number(d.amount||0).toLocaleString('id-ID')}${d.reason ? ` (${d.reason})` : ""}`).join('<br/>');
    const html = `<!doctype html>
      <html>
      <head>
        <meta charset='utf-8'/>
        <title>Slip Gaji - ${user.name}</title>
        <img src='/assets/Logo Square.jpg' alt='Logo' width='120' />
        <style>
          body { font-family: Arial, sans-serif; color: #000; }
          .wrap { max-width: 720px; margin: 24px auto; }
          .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: 700; }
          .sub { color: #555; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 14px; }
          .right { text-align: right; }
          .bold { font-weight: 700; }
          .mt { margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class='wrap'>
          <div class='header'>
            <div>
              <div class='title'>Slip Gaji</div>
              <div class='sub'>Nama: ${user.name} • Periode: ${monthLabel}</div>
            </div>
          </div>
          <table>
            <tr><td>Pokok</td><td class='right'>Rp ${(me.user.baseSalary || 0).toLocaleString('id-ID')}</td></tr>
            <tr><td>Potongan Keterlambatan</td><td class='right'>Rp ${(me.penalty || 0).toLocaleString('id-ID')}</td></tr>
            <tr><td>Potongan Denda</td><td class='right'>Rp ${(me.manualPenalty || 0).toLocaleString('id-ID')}</td></tr>
            <tr><td>Overtime</td><td class='right'>Rp ${(me.overtimePay || 0).toLocaleString('id-ID')}</td></tr>
            <tr><td>Bonus Bulan Ini</td><td class='right'>Rp ${(me.bonus || 0).toLocaleString('id-ID')}</td></tr>
            <tr><td class='bold'>Total (tanpa bonus)</td><td class='right bold'>Rp ${(me.netSalary || 0).toLocaleString('id-ID')}</td></tr>
            <tr><td class='bold'>Total + Bonus</td><td class='right bold'>Rp ${(Number(me.netSalary || 0) + Number(me.bonus || 0)).toLocaleString('id-ID')}</td></tr>
          </table>
          ${manualPenaltyLines ? `<div class='sub mt'>Detail penalty manual:<br/>${manualPenaltyLines}</div>` : ''}
          <div class='sub mt'>Slip ini dihasilkan otomatis oleh sistem.</div>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body></nhtml>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-end gap-3">
        <div>
          <Label>Tahun</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bulan</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => (<SelectItem key={m} value={m}>{m.padStart(2,'0')}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={load} disabled={loading}>Terapkan</Button>
        <Button onClick={printPdf} disabled={!me}>Unduh PDF</Button>
      </div>

      {!me ? (
        <div className="text-sm text-gray-600">{loading ? 'Loading...' : 'Data tidak tersedia.'}</div>
      ) : (
        <section className="border rounded-md p-4 space-y-3 bg-white">
          <div className="flex items-center gap-3">
            <Image src="/assets/Logo Square.jpg" alt="Logo" width={80} height={80} />
            <div>
              <div className="text-lg font-semibold">Slip Gaji</div>
              <div className="text-xs text-gray-600">{user?.name} • {String(month).padStart(2,'0')}/{year}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>Pokok: <span className="font-medium">Rp {(me.user.baseSalary || 0).toLocaleString('id-ID')}</span></div>
            <div>Potongan Keterlambatan: <span className="font-medium">Rp {(me.penalty || 0).toLocaleString('id-ID')}</span></div>
            <div>Potongan Denda: <span className="font-medium">Rp {(me.manualPenalty || 0).toLocaleString('id-ID')}</span></div>
            {me.manualPenaltyDetails && me.manualPenaltyDetails.length > 0 && (
              <div className="md:col-span-2 text-xs text-gray-600">
                Detail penalty manual:
                <ul className="list-disc list-inside space-y-0.5">
                  {me.manualPenaltyDetails.map((d, idx) => (
                    <li key={idx}>Rp {Number(d.amount || 0).toLocaleString('id-ID')}{d.reason ? ` - ${d.reason}` : ""}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>Overtime: <span className="font-medium">Rp {(me.overtimePay || 0).toLocaleString('id-ID')}</span></div>
            <div>Bonus Bulan Ini: <span className="font-medium">Rp {(me.bonus || 0).toLocaleString('id-ID')}</span></div>
          </div>
          <div className="text-base">Total (tanpa bonus): <span className="font-semibold">Rp {(me.netSalary || 0).toLocaleString('id-ID')}</span></div>
          <div className="text-base">Total + Bonus: <span className="font-semibold">Rp {(Number(me.netSalary || 0) + Number(me.bonus || 0)).toLocaleString('id-ID')}</span></div>
        </section>
      )}
    </main>
  );
}
