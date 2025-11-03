"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FinanceCategory } from "@prisma/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";

type Metrics = {
  actualRevenueByOutlet: Array<{ outlet: string; amount: number; totalAmount: number; discountPct: number }>;
  actualRevenueByOutletRegion: Array<{ outletRegion: string; amount: number; totalAmount: number; discountPct: number }>;
  actualRevenueTotal: number;
  bahanBudget: number;
  totalOmsetPaid: number;
  totalOmsetPaidByOutlet: Array<{ outlet: string; amount: number }>;
  danaTertahan: Array<{ outlet: string; amount: number }>;
  danaTertahanTotal: number;
  danaTertahanDetails: Array<{ outlet: string; entries: Array<{ customer: string; amount: number; location: string }> }>;
  totalPlanAmount: number;
  planEntries: ApiPlanEntry[];
  totalActualSpent: number;
  actualEntries: ApiActualEntry[];
  netMargin: number;
  pinjamModal: number;
};

type SalesData = {
  byOutlet: Record<string, { count: number; actual: number; potonganPct: number | null; potonganAmount: number }>;
  byOutletRegion: Record<string, { count: number; actual: number; potonganPct: number | null; potonganAmount: number }>;
  totalActual: number;
  avgPotonganPct: number | null;
  totalPotonganAmount: number;
};

// Typed shapes for plan data by category
type BahanPlanData = {
  budget: number;
  kebutuhan: number;
  note?: string;
  differenceType: "EKSPANSI" | "SISA";
  differenceValue: number;
};

type PayrollOvertimeEntry = { name: string; amount: number };
type PayrollPlanData = {
  baseSalary: number;
  totalOvertime: number;
  totalPayroll: number;
  overtimeEntries: PayrollOvertimeEntry[];
};

type SimpleItem = { name: string; amount: number };
type SimpleItemsPlanData = { items: SimpleItem[] };

type PerlengkapanItem = { type: "PRODUKSI" | "OPERASIONAL"; name: string; amount: number };
type PerlengkapanPlanData = { items: PerlengkapanItem[] };

type MarketingPlanData = { value: number };

type PlanDataByCategory = {
  BAHAN: BahanPlanData;
  PAYROLL: PayrollPlanData;
  BUILDING: SimpleItemsPlanData;
  OPERASIONAL: SimpleItemsPlanData;
  TRANSPORT: SimpleItemsPlanData;
  PERLENGKAPAN: PerlengkapanPlanData;
  MARKETING: MarketingPlanData;
};

type ApiPlanEntry<C extends FinanceCategory = FinanceCategory> = {
  id: number;
  category: C;
  amount: number;
  data: PlanDataByCategory[C];
};

type ApiActualEntry<C extends FinanceCategory = FinanceCategory> = {
  id: number;
  category: C;
  amount: number;
  data: PlanDataByCategory[C] | unknown;
};

type PlanEntryDraft<C extends FinanceCategory = FinanceCategory> = {
  amount: number;
  data: PlanDataByCategory[C];
};

type PlanDraftState = Partial<Record<FinanceCategory, PlanEntryDraft>>;

type WeekOption = {
  id: number;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
};

type PlanDetailResponse = {
  period: {
    id: number;
    name: string;
    weekId: number | null;
    week: WeekOption | null;
    startDate: string;
    endDate: string;
  } | null;
  planEntries: ApiPlanEntry[];
  actualEntries: ApiActualEntry[];
};

const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  BAHAN: "Bahan",
  PAYROLL: "Payroll",
  BUILDING: "Building",
  OPERASIONAL: "Operasional",
  TRANSPORT: "Transport",
  PERLENGKAPAN: "Perlengkapan",
  MARKETING: "Marketing",
};

const CATEGORY_OPTIONS: Array<{ value: FinanceCategory; label: string }> = Object.entries(CATEGORY_LABELS).map(
  ([value, label]) => ({ value: value as FinanceCategory, label }),
);

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function monthKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatMonthLabel(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1] ?? `Bulan ${month}`;
  return `${name} ${year}`;
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDateRange(from?: Date, to?: Date): string {
  if (!from || !to) return "-";
  return `${from.toLocaleDateString("id-ID")} - ${to.toLocaleDateString("id-ID")}`;
}

function formatWeekLabel(week: WeekOption): string {
  const start = new Date(week.startDate).toLocaleDateString("id-ID");
  const end = new Date(week.endDate).toLocaleDateString("id-ID");
  return `${week.name} (${start} - ${end})`;
}

export default function FinancePlanPage() {
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);
  const [currentPeriodName, setCurrentPeriodName] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [draftEntries, setDraftEntries] = useState<PlanDraftState>({});
  const [activeCategory, setActiveCategory] = useState<FinanceCategory | null>(null);

  const loadWeeks = useCallback(async () => {
    const res = await fetch("/api/finance/weeks");
    if (!res.ok) {
      console.error("Failed to load finance weeks");
      return;
    }
    const data = await res.json();
    const list: WeekOption[] = Array.isArray(data.weeks) ? data.weeks : [];
    list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    setWeeks(list);
  }, []);

  const loadPlanDetailByWeek = useCallback(async (weekId: number): Promise<number | null> => {
    try {
      const res = await fetch(`/api/finance/plan?weekId=${weekId}`);
      if (res.status === 404) {
        const week = weeks.find((item) => item.id === weekId);
        setCurrentPeriodId(null);
        setCurrentPeriodName(week?.name ?? "");
        setDraftEntries({});
        return null;
      }
      if (!res.ok) {
        console.error("Failed to load plan detail");
        return null;
      }
      const data = (await res.json()) as PlanDetailResponse;
      if (!data.period) {
        const week = weeks.find((item) => item.id === weekId);
        setCurrentPeriodId(null);
        setCurrentPeriodName(week?.name ?? "");
        setDraftEntries({});
        return null;
      }

      setCurrentPeriodId(data.period.id);
      setCurrentPeriodName(data.period.name);

      const periodWeek = data.period.week;
      if (periodWeek) {
        setWeeks((prev) => {
          const exists = prev.some((item) => item.id === periodWeek.id);
          if (exists) return prev;
          const next = [...prev, periodWeek];
          next.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
          return next;
        });
        setFrom(new Date(periodWeek.startDate));
        setTo(new Date(periodWeek.endDate));
      } else {
        setFrom(new Date(data.period.startDate));
        setTo(new Date(data.period.endDate));
      }

      const newDraft: PlanDraftState = {};
      data.planEntries.forEach((entry) => {
        newDraft[entry.category] = { amount: entry.amount, data: entry.data };
      });
      setDraftEntries(newDraft);

      return data.period.id;
    } catch (error) {
      console.error("Failed to load plan detail", error);
      return null;
    }
  }, [weeks]);

  const loadMetricsData = useCallback(async (periodId: number | null, weekId: number) => {
    setLoadingMetrics(true);
    try {
      const query = new URLSearchParams();
      query.set("weekId", String(weekId));
      if (periodId) {
        query.set("periodId", String(periodId));
      }
      const res = await fetch(`/api/finance/metrics?${query.toString()}`);
      if (!res.ok) {
        console.error("Failed to load finance metrics");
        return;
      }
      const data = (await res.json()) as Metrics;
      setMetrics(data);
      if (periodId && data.planEntries && data.planEntries.length > 0) {
        const newDraft: PlanDraftState = {};
        data.planEntries.forEach((entry) => {
          newDraft[entry.category] = { amount: entry.amount, data: entry.data };
        });
        setDraftEntries((prev) => ({ ...prev, ...newDraft }));
      }
    } catch (error) {
      console.error("Failed to load finance metrics", error);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  const loadSalesData = useCallback(async (weekId: number) => {
    setLoadingSales(true);
    try {
      const res = await fetch(`/api/finance/sales?weekId=${weekId}`);
      if (!res.ok) {
        console.error("Failed to load finance sales data");
        return;
      }
      const data = await res.json();
      setSalesData(data);
    } catch (error) {
      console.error("Failed to load finance sales data", error);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    loadWeeks();
  }, [loadWeeks]);

  useEffect(() => {
    if (weeks.length === 0) {
      setSelectedMonthKey("");
      setSelectedWeekId("");
      return;
    }
    if (!selectedMonthKey || !weeks.some((week) => monthKey(week.month, week.year) === selectedMonthKey)) {
      const firstWeek = weeks[0];
      const key = monthKey(firstWeek.month, firstWeek.year);
      setSelectedMonthKey(key);
      setSelectedWeekId(String(firstWeek.id));
    }
  }, [weeks, selectedMonthKey]);

  useEffect(() => {
    if (!selectedMonthKey) {
      setSelectedWeekId("");
      setCurrentPeriodId(null);
      setCurrentPeriodName("");
      setDraftEntries({});
      setMetrics(null);
      return;
    }
    const [yearStr, monthStr] = selectedMonthKey.split("-");
    const month = Number(monthStr);
    const year = Number(yearStr);
    const availableWeeks = weeks
      .filter((week) => week.month === month && week.year === year)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    if (availableWeeks.length === 0) {
      setSelectedWeekId("");
      setCurrentPeriodId(null);
      setCurrentPeriodName("");
      setDraftEntries({});
      setMetrics(null);
      return;
    }
    if (!availableWeeks.some((week) => String(week.id) === selectedWeekId)) {
      setSelectedWeekId(String(availableWeeks[0].id));
    }
  }, [selectedMonthKey, weeks, selectedWeekId]);

  useEffect(() => {
    if (!selectedWeekId) {
      setFrom(undefined);
      setTo(undefined);
      setCurrentPeriodId(null);
      setCurrentPeriodName("");
      setDraftEntries({});
      setMetrics(null);
      return;
    }
    const week = weeks.find((item) => String(item.id) === selectedWeekId);
    if (week) {
      setFrom(new Date(week.startDate));
      setTo(new Date(week.endDate));
      setCurrentPeriodName((prev) => (prev ? prev : week.name));
    }
    const weekIdNumber = Number(selectedWeekId);
    if (Number.isNaN(weekIdNumber)) return;
    (async () => {
      const periodId = await loadPlanDetailByWeek(weekIdNumber);
      await Promise.all([
        loadMetricsData(periodId, weekIdNumber),
        loadSalesData(weekIdNumber)
      ]);
    })();
  }, [selectedWeekId, weeks, loadPlanDetailByWeek, loadMetricsData, loadSalesData]);

  const monthOptions = useMemo(() => {
    const map = new Map<string, { key: string; month: number; year: number }>();
    weeks.forEach((week) => {
      const key = monthKey(week.month, week.year);
      if (!map.has(key)) {
        map.set(key, { key, month: week.month, year: week.year });
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [weeks]);

  const weeksInSelectedMonth = useMemo(() => {
    if (!selectedMonthKey) return [] as WeekOption[];
    const [yearStr, monthStr] = selectedMonthKey.split("-");
    const month = Number(monthStr);
    const year = Number(yearStr);
    return weeks
      .filter((week) => week.month === month && week.year === year)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [selectedMonthKey, weeks]);

  const selectedWeek = useMemo(() => {
    return weeks.find((week) => String(week.id) === selectedWeekId) ?? null;
  }, [weeks, selectedWeekId]);

  const selectedWeekLabel = useMemo(() => {
    return selectedWeek ? formatWeekLabel(selectedWeek) : "";
  }, [selectedWeek]);

  const draftEntriesList = useMemo(() => {
    return CATEGORY_OPTIONS.filter((item) => draftEntries[item.value]).map((item) => ({
      category: item.value,
      label: item.label,
      amount: draftEntries[item.value]!.amount,
      data: draftEntries[item.value]!.data,
    }));
  }, [draftEntries]);

  const totalDraftAmount = draftEntriesList.reduce((sum, entry) => sum + entry.amount, 0);
  const actualRevenueTotal = salesData?.totalActual ?? 0;
  const totalOmsetPaid = metrics?.totalOmsetPaid ?? 0;
  const netMarginDisplay = actualRevenueTotal - totalDraftAmount;
  const pinjamModalDisplay = totalDraftAmount > totalOmsetPaid ? totalDraftAmount - totalOmsetPaid : 0;
  const bahanBudget = metrics?.bahanBudget ?? 0;

  // Pembagian rekening (berdasarkan draft plan per kategori)
  const amountBAHAN = draftEntries.BAHAN?.amount ?? 0;
  const amountOPERASIONAL = draftEntries.OPERASIONAL?.amount ?? 0;
  const amountTRANSPORT = draftEntries.TRANSPORT?.amount ?? 0;
  const amountPERLENGKAPAN = draftEntries.PERLENGKAPAN?.amount ?? 0;
  const amountPAYROLL = draftEntries.PAYROLL?.amount ?? 0;
  const amountBUILDING = draftEntries.BUILDING?.amount ?? 0;
  const amountMARKETING = draftEntries.MARKETING?.amount ?? 0;

  const rekeningOperasionalTotal = amountBAHAN + amountOPERASIONAL + amountTRANSPORT + amountPERLENGKAPAN;
  const rekeningPayrollBuildingTotal = amountPAYROLL + amountBUILDING;
  const rekeningMarketingTotal = amountMARKETING;
  // Sisa ke tabungan: hanya dari dana diterima (PAID), tidak termasuk dana tertahan
  const rekeningTabunganTotal = Math.max(totalOmsetPaid - (rekeningOperasionalTotal + rekeningPayrollBuildingTotal + rekeningMarketingTotal), 0);

  const handleCategorySubmit = (category: FinanceCategory, entry: PlanEntryDraft) => {
    setDraftEntries((prev) => ({ ...prev, [category]: entry }));
    setActiveCategory(null);
  };

  const handleRemoveCategory = (category: FinanceCategory) => {
    setDraftEntries((prev) => {
      const copy = { ...prev };
      delete copy[category];
      return copy;
    });
  };

  const handleSavePlan = async () => {
    const weekIdNumber = selectedWeekId ? Number(selectedWeekId) : NaN;
    if (Number.isNaN(weekIdNumber)) {
      alert("Pilih minggu terlebih dahulu");
      return;
    }
    const week = weeks.find((item) => item.id === weekIdNumber);
    if (!week) {
      alert("Data minggu tidak ditemukan");
      return;
    }
    const name = currentPeriodName.trim() || week.name;
    if (!name) {
      alert("Nama periode wajib diisi");
      return;
    }
    const entriesPayload = draftEntriesList.map((entry) => ({
      category: entry.category,
      amount: entry.amount,
      data: entry.data,
    }));

    const payload = {
      period: {
        id: currentPeriodId ?? undefined,
        name,
        weekId: weekIdNumber,
      },
      entries: entriesPayload,
    };

    const res = await fetch("/api/finance/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Gagal menyimpan plan");
      return;
    }

    const data = (await res.json()) as PlanDetailResponse;
    const savedWeek = data.period?.week ?? week;
    const savedWeekId = data.period?.weekId ?? savedWeek.id;

    if (savedWeek) {
      const key = monthKey(savedWeek.month, savedWeek.year);
      setSelectedMonthKey(key);
      setSelectedWeekId(String(savedWeekId));
      setCurrentPeriodName(data.period?.name ?? savedWeek.name);
    } else {
      setCurrentPeriodName(data.period?.name ?? name);
    }

    setCurrentPeriodId(data.period?.id ?? null);
    setDraftEntries(() => {
      const next: PlanDraftState = {};
      data.planEntries.forEach((entry) => {
        next[entry.category] = { amount: entry.amount, data: entry.data };
      });
      return next;
    });

    await loadWeeks();
    await loadMetricsData(data.period?.id ?? null, savedWeekId);
    alert("Plan berhasil disimpan");
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Pilih Bulan</Label>
          <Select value={selectedMonthKey} onValueChange={setSelectedMonthKey} disabled={monthOptions.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder={monthOptions.length === 0 ? "Belum ada minggu" : "Pilih Bulan"} />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.length === 0 && (
                <SelectItem value="__empty" disabled>
                  Belum ada data bulan
                </SelectItem>
              )}
              {monthOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {formatMonthLabel(option.month, option.year)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Pilih Minggu</Label>
          <Select
            value={selectedWeekId}
            onValueChange={setSelectedWeekId}
            disabled={weeksInSelectedMonth.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={weeksInSelectedMonth.length === 0 ? "Tidak ada minggu" : "Pilih Minggu"} />
            </SelectTrigger>
            <SelectContent>
              {weeksInSelectedMonth.length === 0 && (
                <SelectItem value="__empty" disabled>
                  Tidak ada minggu pada bulan ini
                </SelectItem>
              )}
              {weeksInSelectedMonth.map((week) => (
                <SelectItem key={week.id} value={String(week.id)}>
                  {formatWeekLabel(week)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rentang Tanggal</Label>
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            {formatDateRange(from, to)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Nama Plan</Label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            {currentPeriodName || "-"}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Minggu Terpilih</Label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            {selectedWeekLabel || "-"}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Total Draft Plan</Label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold">
            {formatCurrency(totalDraftAmount)}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Aktual Revenue (Sales)</h2>
          {(loadingMetrics || loadingSales) && <span className="text-sm text-gray-500">Loading...</span>}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Outlet</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Potongan %</TableHead>
              <TableHead className="text-right">Jumlah Potongan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesData?.byOutlet && Object.entries(salesData.byOutlet).map(([outlet, data]) => (
              <TableRow key={outlet}>
                <TableCell>{outlet}</TableCell>
                <TableCell className="text-right">{formatCurrency(data.actual)}</TableCell>
                <TableCell className="text-right">
                  {data.potonganPct !== null && data.potonganPct > 0 ? `${data.potonganPct}%` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {data.potonganAmount > 0 ? formatCurrency(data.potonganAmount) : "-"}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(salesData?.totalActual || 0)}
              </TableCell>
              <TableCell className="text-right font-medium">-</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(salesData?.totalPotonganAmount || 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        
        {/* Outlet + Region Table */}
        {salesData?.byOutletRegion && Object.keys(salesData.byOutletRegion).length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">By Outlet + Region</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Outlet + Region</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Potongan %</TableHead>
                  <TableHead className="text-right">Jumlah Potongan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(salesData.byOutletRegion).map(([outletRegion, data]) => (
                  <TableRow key={outletRegion}>
                    <TableCell>{outletRegion}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.actual)}</TableCell>
                    <TableCell className="text-right">
                      {data.potonganPct !== null && data.potonganPct > 0 ? `${data.potonganPct}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.potonganAmount > 0 ? formatCurrency(data.potonganAmount) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label>Tambah Plan Pengeluaran</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={activeCategory ?? ""} onValueChange={(value) => setActiveCategory(value as FinanceCategory)}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  if (!activeCategory) {
                    alert("Pilih kategori terlebih dahulu");
                    return;
                  }
                  setActiveCategory(activeCategory);
                }}
                type="button"
              >
                Open Form
              </Button>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draftEntriesList.map((entry) => (
              <TableRow key={entry.category}>
                <TableCell className="font-medium">{CATEGORY_LABELS[entry.category]}</TableCell>
                <TableCell>
                  <PlanEntryDetails category={entry.category} data={entry.data} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(entry.amount)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveCategory(entry.category)}
                      type="button"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCategory(entry.category)}
                      type="button"
                    >
                      Hapus
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {draftEntriesList.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                  Belum ada kategori plan
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Budget Bahan (HPP)</div>
          <div className="text-lg font-semibold">{formatCurrency(bahanBudget)}</div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Total Omset Diterima (Order status PAID)</div>
          <div className="text-lg font-semibold">{formatCurrency(totalOmsetPaid)}</div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Net Margin (Actual Revenue - Plan)</div>
          <div className={cn("text-lg font-semibold", netMarginDisplay < 0 && "text-red-600")}>
            {formatCurrency(netMarginDisplay)}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Pinjam Modal (jika omset &lt; plan)</div>
          <div className={cn("text-lg font-semibold", pinjamModalDisplay > 0 ? "text-red-600" : "")}>
            {formatCurrency(pinjamModalDisplay)}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-700">
          <div className="font-medium mb-1">Pembagian Rekening</div>
          <ul className="space-y-2">
            <li>
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium">5485340804 - Haikal Hamizan Hazmi</span> (Rekening Operasional)
                  <div className="text-xs text-gray-600">Kategori: Bahan, Operasional, Transport, Perlengkapan</div>
                </span>
                <span className="font-semibold whitespace-nowrap">{formatCurrency(rekeningOperasionalTotal)}</span>
              </div>
            </li>
            <li>
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium">7105267037 - Haikal Hamizan Hazmi</span> (Rekening Payroll &amp; Building)
                  <div className="text-xs text-gray-600">Kategori: Building, Payroll</div>
                </span>
                <span className="font-semibold whitespace-nowrap">{formatCurrency(rekeningPayrollBuildingTotal)}</span>
              </div>
            </li>
            <li>
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium">2801721259 - Faaiz Fadlurahman Falih</span> (Marketing)
                  <div className="text-xs text-gray-600">Kategori: Marketing</div>
                </span>
                <span className="font-semibold whitespace-nowrap">{formatCurrency(rekeningMarketingTotal)}</span>
              </div>
            </li>
            <li>
              <div className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium">0343961275 - Sri Hayati</span> (Rekening Tabungan)
                  <div className="text-xs text-gray-600">
                    Sisa keuntungan setelah pembagian ditransfer ke sini. Hanya dana yang sudah diterima
                    (tidak termasuk dana tertahan).
                  </div>
                </span>
                <span className="font-semibold whitespace-nowrap">{formatCurrency(rekeningTabunganTotal)}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Contoh: profit Rp 1.000.000, sisa pembagian Rp 100.000 dan Rp 900.000 masih tertahan,
                maka yang tercatat Rp 100.000.
              </div>
            </li>
          </ul>
        </div>
        <h2 className="font-semibold">Total Omset Diterima (Order status PAID)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Outlet</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(metrics?.totalOmsetPaidByOutlet || []).map((item) => (
              <TableRow key={item.outlet}>
                <TableCell>{item.outlet}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
            {(!metrics || (metrics.totalOmsetPaidByOutlet || []).length === 0) && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-gray-500">
                  Tidak ada omset diterima
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(metrics?.totalOmsetPaid || 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Dana Tertahan (Order status NOT PAID)</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Outlet</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(metrics?.danaTertahan || []).map((item) => (
              <Fragment key={`dana-${item.outlet}`}>
                <TableRow key={item.outlet}>
                  <TableCell className="font-medium">{item.outlet}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                </TableRow>
                {/* Details rows */}
                {(metrics?.danaTertahanDetails || [])
                  .filter((d) => d.outlet === item.outlet)
                  .flatMap((d) => d.entries)
                  .map((entry, idx) => (
                    <TableRow key={`${item.outlet}-detail-${idx}`}>
                      <TableCell className="pl-6 text-sm text-gray-700">
                        <Badge color="green" className="text-xs mr-2">{entry.location || '-'}</Badge>
                        {entry.customer || '-'}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-700">{formatCurrency(entry.amount)}</TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            ))}
            {(!metrics || (metrics.danaTertahan || []).length === 0) && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-gray-500">
                  Tidak ada dana tertahan
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(metrics?.danaTertahanTotal || 0)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSavePlan} className="px-6" disabled={!selectedWeek}>
          Simpan Plan
        </Button>
      </div>

      {activeCategory && (
        <CategoryDialog
          category={activeCategory}
          bahanBudget={bahanBudget}
          initial={draftEntries[activeCategory]}
          onClose={() => setActiveCategory(null)}
          onSubmit={(entry) => handleCategorySubmit(activeCategory, entry)}
        />
      )}
    </div>
  );
}


function PlanEntryDetails({ category, data }: { category: FinanceCategory; data: unknown }) {
  if (!data) return <span className="text-sm text-gray-500">-</span>;

  switch (category) {
    case "BAHAN":
      return (
        <div className="space-y-1 text-sm">
          {(() => {
            const d = data as BahanPlanData;
            return (
              <>
                <div>Budget: {formatCurrency(d?.budget ?? 0)}</div>
                <div>Kebutuhan: {formatCurrency(d?.kebutuhan ?? 0)}</div>
                {typeof d?.differenceValue === "number" && (
                  <div>
                    {d.differenceType === "EKSPANSI" ? (
                      <Badge color="red">Ekspansi {formatCurrency(d.differenceValue)}</Badge>
                    ) : (
                      <Badge color="green">Sisa {formatCurrency(d.differenceValue)}</Badge>
                    )}
                  </div>
                )}
              </>
            );
          })()}
          <div className="text-xs text-gray-500 italic">Belum Termasuk Susu</div>
        </div>
      );
    case "PAYROLL":
      return (
        <div className="space-y-1 text-sm">
          {(() => {
            const d = data as PayrollPlanData;
            return (
              <>
                <div>Pokok: {formatCurrency(d?.baseSalary ?? 0)}</div>
                <div>Overtime: {formatCurrency(d?.totalOvertime ?? 0)}</div>
                <div>Total Payroll: {formatCurrency(d?.totalPayroll ?? 0)}</div>
                {Array.isArray(d?.overtimeEntries) && d.overtimeEntries.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500">Detail Overtime:</div>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {d.overtimeEntries.map((entry: PayrollOvertimeEntry, idx: number) => (
                        <li key={`${entry?.name ?? idx}-${idx}`}>
                          {entry?.name}: {formatCurrency(entry?.amount ?? 0)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      );
    case "BUILDING":
    case "OPERASIONAL":
    case "TRANSPORT":
      return (
        <div className="text-sm text-gray-600">
          {(() => {
            const d = data as SimpleItemsPlanData;
            return (d?.items || []).map((item: SimpleItem, idx: number) => (
              <div key={`${item?.name ?? idx}-${idx}`} className="flex justify-between gap-4">
                <span>{item?.name}</span>
                <span>{formatCurrency(item?.amount ?? 0)}</span>
              </div>
            ));
          })()}
        </div>
      );
    case "PERLENGKAPAN":
      return (
        <div className="text-sm text-gray-600">
          {(() => {
            const d = data as PerlengkapanPlanData;
            return (d?.items || []).map((item: PerlengkapanItem, idx: number) => (
              <div key={`${item?.name ?? idx}-${idx}`} className="flex justify-between gap-4">
                <span>
                  <Badge className="mr-2" color={item?.type === "PRODUKSI" ? "green" : "gray"}>
                    {item?.type}
                  </Badge>
                  {item?.name}
                </span>
                <span>{formatCurrency(item?.amount ?? 0)}</span>
              </div>
            ));
          })()}
        </div>
      );
    case "MARKETING":
      {const d = data as MarketingPlanData; return <div className="text-sm">Total: {formatCurrency(d?.value ?? 0)}</div>;}
    default:
      return <span className="text-sm text-gray-500">-</span>;
  }
}

function CategoryDialog({
  category,
  initial,
  bahanBudget,
  onClose,
  onSubmit,
}: {
  category: FinanceCategory;
  initial?: PlanEntryDraft;
  bahanBudget: number;
  onClose: () => void;
  onSubmit: (entry: PlanEntryDraft) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan {CATEGORY_LABELS[category]}</DialogTitle>
        </DialogHeader>
        {category === "BAHAN" && (
          <BahanPlanForm initial={initial} budget={bahanBudget} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "PAYROLL" && (
          <PayrollPlanForm initial={initial} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "BUILDING" && (
          <BuildingPlanForm initial={initial} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "OPERASIONAL" && (
          <SimpleListPlanForm category={category} initial={initial} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "TRANSPORT" && (
          <SimpleListPlanForm category={category} initial={initial} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "PERLENGKAPAN" && (
          <PerlengkapanPlanForm initial={initial} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "MARKETING" && (
          <MarketingPlanForm initial={initial} onCancel={onClose} onSubmit={onSubmit} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BahanPlanForm({
  initial,
  budget,
  onCancel,
  onSubmit,
}: {
  initial?: PlanEntryDraft;
  budget: number;
  onCancel: () => void;
  onSubmit: (entry: PlanEntryDraft) => void;
}) {
  const initialData = (initial?.data ?? {}) as BahanPlanData;
  const [kebutuhan, setKebutuhan] = useState<string>(
    initialData?.kebutuhan ? String(initialData.kebutuhan) : initial ? String(initial.amount) : "",
  );
  const effectiveBudget = initialData?.budget ?? (budget || 0);
  const kebutuhanValue = Number(kebutuhan || 0);
  const gap = kebutuhanValue - effectiveBudget;
  const differenceType = gap > 0 ? "EKSPANSI" : "SISA";
  const differenceValue = Math.abs(gap);

  const handleSubmit = () => {
    if (!kebutuhan.trim()) {
      alert("Isi kebutuhan terlebih dahulu");
      return;
    }
    const amount = Math.round(Number(kebutuhan));
    onSubmit({
      amount,
      data: {
        budget: effectiveBudget,
        kebutuhan: amount,
        note: "Belum Termasuk Susu",
        differenceType,
        differenceValue,
      },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Budget Bahan (HPP)</Label>
          <Input value={effectiveBudget} readOnly className="bg-gray-50" />
        </div>
        <div className="space-y-1">
          <Label>Kebutuhan (Rp)</Label>
          <Input
            type="number"
            min="0"
            value={kebutuhan}
            onChange={(e) => setKebutuhan(e.target.value)}
            placeholder="Masukkan kebutuhan"
          />
          <div className="text-xs text-gray-500">Belum Termasuk Susu</div>
        </div>
        <div className="space-y-1">
          <Label>Sisa / Ekspansi</Label>
          <div className={cn("text-sm font-medium", differenceType === "EKSPANSI" ? "text-red-600" : "text-green-600")}>
            {differenceType === "EKSPANSI" ? "Ekspansi" : "Sisa"} {formatCurrency(differenceValue)}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Simpan</Button>
      </DialogFooter>
    </>
  );
}

function PayrollPlanForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: PlanEntryDraft;
  onCancel: () => void;
  onSubmit: (entry: PlanEntryDraft) => void;
}) {
  const initialData = (initial?.data ?? {}) as PayrollPlanData;
  const [baseSalary, setBaseSalary] = useState<string>(
    initialData?.baseSalary ? String(initialData.baseSalary) : "8650000",
  );
  const [overtimeEntries, setOvertimeEntries] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.overtimeEntries)
      ? (initialData.overtimeEntries as PayrollOvertimeEntry[]).map((item) => ({
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : [],
  );
  const [overtimeName, setOvertimeName] = useState("");
  const [overtimeAmount, setOvertimeAmount] = useState("");

  const addOvertime = () => {
    if (!overtimeName.trim() || !overtimeAmount.trim()) {
      alert("Nama dan nilai lembur wajib diisi");
      return;
    }
    setOvertimeEntries((prev) => [...prev, { name: overtimeName, amount: overtimeAmount }]);
    setOvertimeName("");
    setOvertimeAmount("");
  };

  const removeOvertime = (index: number) => {
    setOvertimeEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const baseSalaryValue = Math.round(Number(baseSalary || 0));
  const totalOvertime = overtimeEntries.reduce((sum, entry) => sum + Math.round(Number(entry.amount || 0)), 0);
  const totalPayroll = baseSalaryValue + totalOvertime;

  const handleSubmit = () => {
    onSubmit({
      amount: totalPayroll,
      data: {
        baseSalary: baseSalaryValue,
        totalOvertime,
        totalPayroll,
        overtimeEntries: overtimeEntries.map((entry) => ({
          name: entry.name,
          amount: Math.round(Number(entry.amount || 0)),
        })),
      },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>Gaji Pokok</Label>
          <Input
            type="number"
            min="0"
            value={baseSalary}
            onChange={(e) => setBaseSalary(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Overtime</Label>
          <div className="flex gap-2">
            <Input
              value={overtimeName}
              onChange={(e) => setOvertimeName(e.target.value)}
              placeholder="Nama"
            />
            <Input
              type="number"
              min="0"
              value={overtimeAmount}
              onChange={(e) => setOvertimeAmount(e.target.value)}
              placeholder="Rp"
            />
            <Button type="button" onClick={addOvertime}>
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {overtimeEntries.map((entry, idx) => (
              <div key={`${entry.name}-${idx}`} className="flex items-center justify-between border rounded-md p-2">
                <div>
                  <div className="font-medium text-sm">{entry.name}</div>
                  <div className="text-xs text-gray-500">{formatCurrency(Number(entry.amount || 0))}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeOvertime(idx)}>
                  Hapus
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div>Total Overtime: {formatCurrency(totalOvertime)}</div>
          <div>Total Payroll: {formatCurrency(totalPayroll)}</div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Simpan</Button>
      </DialogFooter>
    </>
  );
}

function BuildingPlanForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: PlanEntryDraft;
  onCancel: () => void;
  onSubmit: (entry: PlanEntryDraft) => void;
}) {
  const defaultItems = [
    { name: "MASS", amount: 500000 },
    { name: "Store", amount: 2500000 },
  ];
  const initialData = (initial?.data ?? {}) as SimpleItemsPlanData;
  const [items, setItems] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? (initialData.items as SimpleItem[]).map((item) => ({
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : defaultItems.map((item) => ({ name: item.name, amount: String(item.amount) })),
  );
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");

  const addItem = () => {
    if (!newItemName.trim() || !newItemAmount.trim()) {
      alert("Nama dan nilai wajib diisi");
      return;
    }
    setItems((prev) => [...prev, { name: newItemName, amount: newItemAmount }]);
    setNewItemName("");
    setNewItemAmount("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const total = items.reduce((sum, item) => sum + Math.round(Number(item.amount || 0)), 0);

  const handleSubmit = () => {
    onSubmit({
      amount: total,
      data: {
        items: items.map((item) => ({
          name: item.name,
          amount: Math.round(Number(item.amount || 0)),
        })),
      },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Item Building</Label>
          {items.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="flex items-center gap-2">
              <Input
                value={item.name}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)),
                  )
                }
              />
              <Input
                type="number"
                min="0"
                value={item.amount}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, amount: e.target.value } : it)),
                  )
                }
              />
              <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                Hapus
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Nama baru"
          />
          <Input
            type="number"
            min="0"
            value={newItemAmount}
            onChange={(e) => setNewItemAmount(e.target.value)}
            placeholder="Rp"
          />
          <Button onClick={addItem}>Add</Button>
        </div>
        <div className="text-sm font-medium">Total: {formatCurrency(total)}</div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Simpan</Button>
      </DialogFooter>
    </>
  );
}

function SimpleListPlanForm({
  category,
  initial,
  onCancel,
  onSubmit,
}: {
  category: FinanceCategory;
  initial?: PlanEntryDraft;
  onCancel: () => void;
  onSubmit: (entry: PlanEntryDraft) => void;
}) {
  const initialData = (initial?.data ?? {}) as SimpleItemsPlanData;
  const [items, setItems] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? (initialData.items as SimpleItem[]).map((item) => ({
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : [],
  );
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");

  const addItem = () => {
    if (!newItemName.trim() || !newItemAmount.trim()) {
      alert("Nama dan nilai wajib diisi");
      return;
    }
    setItems((prev) => [...prev, { name: newItemName, amount: newItemAmount }]);
    setNewItemName("");
    setNewItemAmount("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const total = items.reduce((sum, item) => sum + Math.round(Number(item.amount || 0)), 0);

  const handleSubmit = () => {
    onSubmit({
      amount: total,
      data: {
        items: items.map((item) => ({
          name: item.name,
          amount: Math.round(Number(item.amount || 0)),
        })),
      },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-4">
        <Label>List {CATEGORY_LABELS[category]}</Label>
        {items.length === 0 && <div className="text-sm text-gray-500">Belum ada item</div>}
        {items.map((item, idx) => (
          <div key={`${item.name}-${idx}`} className="flex items-center gap-2">
            <Input
              value={item.name}
              onChange={(e) =>
                setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)))
              }
              placeholder="Nama"
            />
            <Input
              type="number"
              min="0"
              value={item.amount}
              onChange={(e) =>
                setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, amount: e.target.value } : it)))
              }
              placeholder="Rp"
            />
            <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
              Hapus
            </Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Nama"
          />
          <Input
            type="number"
            min="0"
            value={newItemAmount}
            onChange={(e) => setNewItemAmount(e.target.value)}
            placeholder="Rp"
          />
          <Button onClick={addItem}>Add</Button>
        </div>
        <div className="text-sm font-semibold">Total: {formatCurrency(total)}</div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Simpan</Button>
      </DialogFooter>
    </>
  );
}

function PerlengkapanPlanForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: PlanEntryDraft;
  onCancel: () => void;
  onSubmit: (entry: PlanEntryDraft) => void;
}) {
  const initialData = (initial?.data ?? {}) as PerlengkapanPlanData;
  const [items, setItems] = useState<Array<{ type: "PRODUKSI" | "OPERASIONAL"; name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? (initialData.items as PerlengkapanItem[]).map((item) => ({
          type: item.type === "OPERASIONAL" ? "OPERASIONAL" : "PRODUKSI",
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : [],
  );
  const [form, setForm] = useState<{ type: "PRODUKSI" | "OPERASIONAL"; name: string; amount: string }>({
    type: "PRODUKSI",
    name: "",
    amount: "",
  });

  const addItem = () => {
    if (!form.name.trim() || !form.amount.trim()) {
      alert("Nama dan nilai wajib diisi");
      return;
    }
    setItems((prev) => [...prev, form]);
    setForm({ type: "PRODUKSI", name: "", amount: "" });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const total = items.reduce((sum, item) => sum + Math.round(Number(item.amount || 0)), 0);

  const handleSubmit = () => {
    onSubmit({
      amount: total,
      data: {
        items: items.map((item) => ({
          type: item.type,
          name: item.name,
          amount: Math.round(Number(item.amount || 0)),
        })),
      },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Daftar Perlengkapan</Label>
          {items.length === 0 && <div className="text-sm text-gray-500">Belum ada item</div>}
          {items.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="flex items-center gap-2">
              <Select
                value={item.type}
                onValueChange={(value) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, type: value as "PRODUKSI" | "OPERASIONAL" } : it)),
                  )
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUKSI">Produksi</SelectItem>
                  <SelectItem value="OPERASIONAL">Operasional</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={item.name}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)),
                  )
                }
                placeholder="Nama"
              />
              <Input
                type="number"
                min="0"
                value={item.amount}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, amount: e.target.value } : it)),
                  )
                }
                placeholder="Rp"
              />
              <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                Hapus
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Select
            value={form.type}
            onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as "PRODUKSI" | "OPERASIONAL" }))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUKSI">Produksi</SelectItem>
              <SelectItem value="OPERASIONAL">Operasional</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nama"
          />
          <Input
            type="number"
            min="0"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Rp"
          />
          <Button onClick={addItem}>Add</Button>
        </div>
        <div className="text-sm font-semibold">Total: {formatCurrency(total)}</div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Simpan</Button>
      </DialogFooter>
    </>
  );
}

function MarketingPlanForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: PlanEntryDraft;
  onCancel: () => void;
  onSubmit: (entry: PlanEntryDraft) => void;
}) {
  const initialData = (initial?.data ?? {}) as MarketingPlanData;
  const [value, setValue] = useState<string>(
    initialData?.value ? String(initialData.value) : initial ? String(initial.amount) : "",
  );

  const handleSubmit = () => {
    const amount = Math.round(Number(value || 0));
    onSubmit({
      amount,
      data: {
        value: amount,
      },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-3">
        <Label>Budget Marketing (Rp)</Label>
        <Input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Masukkan nilai marketing"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSubmit}>Simpan</Button>
      </DialogFooter>
    </>
  );
}
