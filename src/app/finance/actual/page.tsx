"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  actualRevenueTotal: number;
  totalOmsetPaid: number;
  totalPlanAmount: number;
  planEntries: ApiPlanEntry[];
  actualEntries: ApiActualEntry[];
  totalActualSpent: number;
  netMargin: number;
  pinjamModal: number;
};

type ApiPlanEntry = {
  id: number;
  category: FinanceCategory;
  amount: number;
  data: any;
};

type ApiActualEntry = {
  id: number;
  category: FinanceCategory;
  amount: number;
  data: any;
};

type ActualEntryDraft = {
  amount: number;
  data: any;
};

type ActualDraftState = Partial<Record<FinanceCategory, ActualEntryDraft>>;

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

export default function FinanceActualPage() {
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);
  const [currentPeriodName, setCurrentPeriodName] = useState("");
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [planEntries, setPlanEntries] = useState<ApiPlanEntry[]>([]);
  const [draftEntries, setDraftEntries] = useState<ActualDraftState>({});
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

  const loadActualDetailByWeek = useCallback(async (weekId: number): Promise<number | null> => {
    try {
      const res = await fetch(`/api/finance/plan?weekId=${weekId}`);
      if (res.status === 404) {
        const week = weeks.find((item) => item.id === weekId);
        setCurrentPeriodId(null);
        setCurrentPeriodName(week?.name ?? "");
        setPlanEntries([]);
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
        setPlanEntries([]);
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

      setPlanEntries(data.planEntries);
      const actualDraft: ActualDraftState = {};
      data.actualEntries.forEach((entry) => {
        actualDraft[entry.category] = { amount: entry.amount, data: entry.data };
      });
      setDraftEntries(actualDraft);

      return data.period.id;
    } catch (error) {
      console.error("Failed to load plan detail", error);
      return null;
    }
  }, [weeks]);

  const loadMetricsData = useCallback(async (periodId: number | null, weekId: number) => {
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
      setPlanEntries([]);
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
      setPlanEntries([]);
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
      setPlanEntries([]);
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
      const periodId = await loadActualDetailByWeek(weekIdNumber);
      await loadMetricsData(periodId, weekIdNumber);
    })();
  }, [selectedWeekId, weeks, loadActualDetailByWeek, loadMetricsData]);

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

  const draftList = useMemo(() => {
    return CATEGORY_OPTIONS.filter(
      (item) => planEntries.some((plan) => plan.category === item.value) || draftEntries[item.value],
    ).map((item) => {
      const plan = planEntries.find((entry) => entry.category === item.value);
      const actual = draftEntries[item.value];
      return {
        category: item.value,
        label: item.label,
        planAmount: plan?.amount ?? 0,
        planData: plan?.data,
        actualAmount: actual?.amount ?? 0,
        actualData: actual?.data,
      };
    });
  }, [planEntries, draftEntries]);

  const totalPlan = draftList.reduce((sum, entry) => sum + entry.planAmount, 0);
  const totalActual = draftList.reduce((sum, entry) => sum + entry.actualAmount, 0);
  const actualRevenueTotal = metrics?.actualRevenueTotal ?? 0;
  const totalOmsetPaid = metrics?.totalOmsetPaid ?? 0;
  const netProfitPlan = actualRevenueTotal - totalPlan;
  const netProfitActual = actualRevenueTotal - totalActual;
  const pinjamModalDisplay = totalPlan > totalOmsetPaid ? totalPlan - totalOmsetPaid : 0;

  const handleCategorySubmit = (category: FinanceCategory, entry: ActualEntryDraft) => {
    setDraftEntries((prev) => ({ ...prev, [category]: entry }));
    setActiveCategory(null);
  };

  const handleSaveActual = async () => {
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
    const entriesPayload = draftList
      .filter((entry) => entry.actualAmount > 0)
      .map((entry) => ({
        category: entry.category,
        amount: entry.actualAmount,
        data: entry.actualData,
      }));

    const res = await fetch("/api/finance/actual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period: {
          id: currentPeriodId ?? undefined,
          name,
          weekId: weekIdNumber,
        },
        entries: entriesPayload,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Gagal menyimpan actual");
      return;
    }
    const data = (await res.json()) as { actualEntries: ApiActualEntry[] };
    const actualDraft: ActualDraftState = {};
    data.actualEntries.forEach((entry) => {
      actualDraft[entry.category] = { amount: entry.amount, data: entry.data };
    });
    setDraftEntries(actualDraft);
    await loadWeeks();
    const updatedPeriodId = await loadActualDetailByWeek(weekIdNumber);
    await loadMetricsData(updatedPeriodId, weekIdNumber);
    alert("Actual berhasil disimpan");
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
          <Select value={selectedWeekId} onValueChange={setSelectedWeekId} disabled={weeksInSelectedMonth.length === 0}>
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

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Minggu Terpilih</Label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            {selectedWeekLabel || "-"}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Nama Plan</Label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            {currentPeriodName || "-"}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Total Plan</Label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold">
            {formatCurrency(totalPlan)}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Total Actual</Label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold">
            {formatCurrency(totalActual)}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Plan vs Actual Pengeluaran</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategori</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead className="text-right">% Realisasi</TableHead>
              <TableHead>Detail Actual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {draftList.map((entry) => {
              const percent = entry.planAmount > 0 ? (entry.actualAmount / entry.planAmount) * 100 : null;
              const overBudget = entry.actualAmount > entry.planAmount && entry.planAmount > 0;
              return (
                <TableRow key={entry.category}>
                  <TableCell className="font-medium">{entry.label}</TableCell>
                  <TableCell>{formatCurrency(entry.planAmount)}</TableCell>
                  <TableCell className={cn(overBudget && "text-red-600 font-semibold")}>
                    {formatCurrency(entry.actualAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {percent === null ? "-" : `${percent.toFixed(1)}%`}
                  </TableCell>
                  <TableCell>
                    <PlanEntryDetails category={entry.category} data={entry.actualData} />
                  </TableCell>
                </TableRow>
              );
            })}
            {draftList.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-gray-500">
                  Belum ada data actual
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label>Tambah Actual Pengeluaran</Label>
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
                type="button"
                onClick={() => {
                  if (!activeCategory) {
                    alert("Pilih kategori terlebih dahulu");
                    return;
                  }
                  setActiveCategory(activeCategory);
                }}
              >
                Open Form
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Actual Revenue</div>
          <div className="text-lg font-semibold">{formatCurrency(actualRevenueTotal)}</div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Total Omset Diterima (PAID)</div>
          <div className="text-lg font-semibold">{formatCurrency(totalOmsetPaid)}</div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Net Margin Berdasarkan Plan</div>
          <div className={cn("text-lg font-semibold", netProfitPlan < 0 && "text-red-600")}>
            {formatCurrency(netProfitPlan)}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Net Margin Aktual</div>
          <div className={cn("text-lg font-semibold", netProfitActual < 0 && "text-red-600")}>
            {formatCurrency(netProfitActual)}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Pinjam Modal (jika omset &lt; plan)</div>
          <div className={cn("text-lg font-semibold", pinjamModalDisplay > 0 ? "text-red-600" : "")}> 
            {formatCurrency(pinjamModalDisplay)}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSaveActual} className="px-6" disabled={!selectedWeek}>
          Simpan Actual
        </Button>
      </div>

      {activeCategory && (
        <ActualCategoryDialog
          category={activeCategory}
          planData={planEntries.find((entry) => entry.category === activeCategory)?.data}
          initial={draftEntries[activeCategory]}
          onClose={() => setActiveCategory(null)}
          onSubmit={(entry) => handleCategorySubmit(activeCategory, entry)}
        />
      )}
    </div>
  );
}


function ActualCategoryDialog({
  category,
  planData,
  initial,
  onClose,
  onSubmit,
}: {
  category: FinanceCategory;
  planData?: any;
  initial?: ActualEntryDraft;
  onClose: () => void;
  onSubmit: (entry: ActualEntryDraft) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Actual {CATEGORY_LABELS[category]}</DialogTitle>
        </DialogHeader>
        {category === "BAHAN" && (
          <BahanActualForm initial={initial} planBudget={planData?.budget ?? 0} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "PAYROLL" && (
          <PayrollActualForm initial={initial} planData={planData} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "BUILDING" && (
          <SimpleActualListForm category={category} initial={initial} planData={planData} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "OPERASIONAL" && (
          <SimpleActualListForm category={category} initial={initial} planData={planData} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "TRANSPORT" && (
          <SimpleActualListForm category={category} initial={initial} planData={planData} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "PERLENGKAPAN" && (
          <PerlengkapanActualForm initial={initial} planData={planData} onCancel={onClose} onSubmit={onSubmit} />
        )}
        {category === "MARKETING" && (
          <MarketingActualForm initial={initial} onCancel={onClose} onSubmit={onSubmit} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanEntryDetails({ category, data }: { category: FinanceCategory; data: any }) {
  if (!data) return <span className="text-sm text-gray-500">-</span>;
  switch (category) {
    case "BAHAN":
      // For Actual: show list of items if available; otherwise fall back to kebutuhan summary
      if (Array.isArray(data?.items) && data.items.length > 0) {
        return (
          <div className="text-sm text-gray-600">
            {data.items.map((item: any, idx: number) => (
              <div key={`${item?.name ?? idx}-${idx}`} className="flex justify-between gap-4">
                <span>{item?.name}</span>
                <span>{formatCurrency(item?.amount ?? 0)}</span>
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="space-y-1 text-sm">
          <div>Kebutuhan: {formatCurrency(data?.kebutuhan ?? 0)}</div>
          {typeof data?.differenceValue === "number" && (
            <div>
              {data.differenceType === "EKSPANSI" ? (
                <Badge color="red">Ekspansi {formatCurrency(data.differenceValue)}</Badge>
              ) : (
                <Badge color="green">Sisa {formatCurrency(data.differenceValue)}</Badge>
              )}
            </div>
          )}
        </div>
      );
    case "PAYROLL":
      return (
        <div className="space-y-1 text-sm">
          <div>Pokok: {formatCurrency(data?.baseSalary ?? 0)}</div>
          <div>Overtime: {formatCurrency(data?.totalOvertime ?? 0)}</div>
          <div>Total Payroll: {formatCurrency(data?.totalPayroll ?? 0)}</div>
        </div>
      );
    case "BUILDING":
    case "OPERASIONAL":
    case "TRANSPORT":
      return (
        <div className="text-sm text-gray-600">
          {(data?.items || []).map((item: any, idx: number) => (
            <div key={`${item?.name ?? idx}-${idx}`} className="flex justify-between gap-4">
              <span>{item?.name}</span>
              <span>{formatCurrency(item?.amount ?? 0)}</span>
            </div>
          ))}
        </div>
      );
    case "PERLENGKAPAN":
      return (
        <div className="text-sm text-gray-600">
          {(data?.items || []).map((item: any, idx: number) => (
            <div key={`${item?.name ?? idx}-${idx}`} className="flex justify-between gap-4">
              <span>
                <Badge className="mr-2" color={item?.type === "PRODUKSI" ? "green" : "gray"}>
                  {item?.type}
                </Badge>
                {item?.name}
              </span>
              <span>{formatCurrency(item?.amount ?? 0)}</span>
            </div>
          ))}
        </div>
      );
    case "MARKETING":
      return <div className="text-sm">{formatCurrency(data?.value ?? 0)}</div>;
    default:
      return <span className="text-sm text-gray-500">-</span>;
  }
}

function BahanActualForm({
  initial,
  planBudget,
  onCancel,
  onSubmit,
}: {
  initial?: ActualEntryDraft;
  planBudget?: number;
  onCancel: () => void;
  onSubmit: (entry: ActualEntryDraft) => void;
}) {
  const initialData = initial?.data ?? {};
  const [items, setItems] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? initialData.items.map((item: any) => ({
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : []
  );
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addItem = () => {
    if (!newName.trim() || !newAmount.trim()) {
      alert("Nama dan nilai wajib diisi");
      return;
    }
    setItems((prev) => [...prev, { name: newName, amount: newAmount }]);
    setNewName("");
    setNewAmount("");
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
        <Label>Actual Bahan</Label>
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
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama" />
          <Input
            type="number"
            min="0"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
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

function PayrollActualForm({
  initial,
  planData,
  onCancel,
  onSubmit,
}: {
  initial?: ActualEntryDraft;
  planData?: any;
  onCancel: () => void;
  onSubmit: (entry: ActualEntryDraft) => void;
}) {
  const initialData = initial?.data ?? {};
  const [baseSalary, setBaseSalary] = useState<string>(
    initialData?.baseSalary ? String(initialData.baseSalary) : planData?.baseSalary ? String(planData.baseSalary) : "",
  );
  const [overtimeEntries, setOvertimeEntries] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.overtimeEntries)
      ? initialData.overtimeEntries.map((item: any) => ({
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : [],
  );
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addOvertime = () => {
    if (!newName.trim() || !newAmount.trim()) {
      alert("Nama dan nilai lembur wajib diisi");
      return;
    }
    setOvertimeEntries((prev) => [...prev, { name: newName, amount: newAmount }]);
    setNewName("");
    setNewAmount("");
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
          <Label>Actual Gaji Pokok</Label>
          <Input type="number" min="0" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Actual Overtime</Label>
          {overtimeEntries.map((entry, idx) => (
            <div key={`${entry.name}-${idx}`} className="flex items-center gap-2">
              <Input
                value={entry.name}
                onChange={(e) =>
                  setOvertimeEntries((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)),
                  )
                }
              />
              <Input
                type="number"
                min="0"
                value={entry.amount}
                onChange={(e) =>
                  setOvertimeEntries((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, amount: e.target.value } : it)),
                  )
                }
              />
              <Button variant="ghost" size="sm" onClick={() => removeOvertime(idx)}>
                Hapus
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama lembur" />
            <Input
              type="number"
              min="0"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Rp"
            />
            <Button onClick={addOvertime}>Add</Button>
          </div>
        </div>
        <div className="text-sm">
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

function SimpleActualListForm({
  category,
  initial,
  planData,
  onCancel,
  onSubmit,
}: {
  category: FinanceCategory;
  initial?: ActualEntryDraft;
  planData?: any;
  onCancel: () => void;
  onSubmit: (entry: ActualEntryDraft) => void;
}) {
  const initialData = initial?.data ?? {};
  const [items, setItems] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? initialData.items.map((item: any) => ({
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : category === "OPERASIONAL"
      ? []
      : Array.isArray(planData?.items)
      ? planData.items.map((item: any) => ({
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : [],
  );
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addItem = () => {
    if (!newName.trim() || !newAmount.trim()) {
      alert("Nama dan nilai wajib diisi");
      return;
    }
    setItems((prev) => [...prev, { name: newName, amount: newAmount }]);
    setNewName("");
    setNewAmount("");
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
        <Label>Actual {CATEGORY_LABELS[category]}</Label>
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
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama" />
          <Input
            type="number"
            min="0"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
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

function PerlengkapanActualForm({
  initial,
  planData,
  onCancel,
  onSubmit,
}: {
  initial?: ActualEntryDraft;
  planData?: any;
  onCancel: () => void;
  onSubmit: (entry: ActualEntryDraft) => void;
}) {
  const initialData = initial?.data ?? {};
  const [items, setItems] = useState<Array<{ type: "PRODUKSI" | "OPERASIONAL"; name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? initialData.items.map((item: any) => ({
          type: item.type === "OPERASIONAL" ? "OPERASIONAL" : "PRODUKSI",
          name: item.name || "",
          amount: item.amount ? String(item.amount) : "",
        }))
      : Array.isArray(planData?.items)
      ? planData.items.map((item: any) => ({
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
        <Label>Actual Perlengkapan</Label>
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

function MarketingActualForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: ActualEntryDraft;
  onCancel: () => void;
  onSubmit: (entry: ActualEntryDraft) => void;
}) {
  const initialData = initial?.data ?? {};
  const [value, setValue] = useState<string>(
    initialData?.value ? String(initialData.value) : initial ? String(initial.amount) : "",
  );

  const handleSubmit = () => {
    const amount = Math.round(Number(value || 0));
    onSubmit({
      amount,
      data: { value: amount },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-3">
        <Label>Actual Marketing (Rp)</Label>
        <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
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
