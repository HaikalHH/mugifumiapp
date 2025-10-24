"use client";

import { useEffect, useMemo, useState } from "react";
import { FinanceCategory } from "@prisma/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { DateTimePicker } from "../../../components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";

type Metrics = {
  actualRevenueByOutlet: Array<{ outlet: string; amount: number }>;
  actualRevenueTotal: number;
  bahanBudget: number;
  totalOmsetPaid: number;
  danaTertahan: Array<{ outlet: string; amount: number }>;
  totalPlanAmount: number;
  planEntries: ApiPlanEntry[];
  totalActualSpent: number;
  actualEntries: ApiActualEntry[];
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

type PeriodSummary = {
  id: number;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  totalPlan: number;
  totalActual: number;
  planEntryCount: number;
  actualEntryCount: number;
};

type PlanEntryDraft = {
  amount: number;
  data: any;
};

type PlanDraftState = Partial<Record<FinanceCategory, PlanEntryDraft>>;

type PlanDetailResponse = {
  period: {
    id: number;
    name: string;
    month: number;
    year: number;
    startDate: string;
    endDate: string;
  };
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

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function endOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function endOfMonthOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function FinancePlanPage() {
  const [from, setFrom] = useState<Date | undefined>(startOfCurrentMonth());
  const [to, setTo] = useState<Date | undefined>(endOfCurrentMonth());
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [planPeriods, setPlanPeriods] = useState<PeriodSummary[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [periodForm, setPeriodForm] = useState({
    name: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [draftEntries, setDraftEntries] = useState<PlanDraftState>({});
  const [activeCategory, setActiveCategory] = useState<FinanceCategory | null>(null);

  // Fetch plan periods list
  const loadPlanPeriods = async () => {
    const res = await fetch("/api/finance/plan");
    if (!res.ok) {
      console.error("Failed to load finance periods");
      return;
    }
    const data = await res.json();
    const periods: PeriodSummary[] = data.periods || [];
    setPlanPeriods(periods);
    if (!selectedPeriodId && periods.length > 0) {
      setSelectedPeriodId(String(periods[0].id));
    }
  };

  const loadPlanDetail = async (periodId: number) => {
    const res = await fetch(`/api/finance/plan?periodId=${periodId}`);
    if (!res.ok) {
      console.error("Failed to load plan detail");
      return;
    }
    const data = (await res.json()) as PlanDetailResponse;
    if (data.period) {
      setPeriodForm({
        name: data.period.name,
        month: data.period.month,
        year: data.period.year,
      });
      const startDate = new Date(data.period.startDate);
      const endDate = new Date(data.period.endDate);
      setFrom(startDate);
      setTo(endDate);
    }
    const newDraft: PlanDraftState = {};
    for (const entry of data.planEntries) {
      newDraft[entry.category] = { amount: entry.amount, data: entry.data };
    }
    setDraftEntries(newDraft);
  };

  const loadMetrics = async (periodId: number | null) => {
    if (!from || !to) return;
    setLoadingMetrics(true);
    try {
      const query = new URLSearchParams();
      query.set("from", from.toISOString());
      query.set("to", to.toISOString());
      if (periodId) query.set("periodId", String(periodId));
      const res = await fetch(`/api/finance/metrics?${query.toString()}`);
      if (!res.ok) {
        console.error("Failed to load finance metrics");
        return;
      }
      const data = (await res.json()) as Metrics;
      setMetrics(data);
      if (periodId && data.planEntries) {
        const newDraft: PlanDraftState = {};
        for (const entry of data.planEntries) {
          newDraft[entry.category] = { amount: entry.amount, data: entry.data };
        }
        setDraftEntries((prev) => ({ ...prev, ...newDraft }));
      }
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    loadPlanPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPeriodId && selectedPeriodId !== "new") {
      const periodId = Number(selectedPeriodId);
      if (!Number.isNaN(periodId)) {
        loadPlanDetail(periodId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriodId]);

  useEffect(() => {
    const periodId = selectedPeriodId && selectedPeriodId !== "new" ? Number(selectedPeriodId) : null;
    loadMetrics(periodId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, selectedPeriodId]);

  useEffect(() => {
    if (!from) return;
    if (selectedPeriodId && selectedPeriodId !== "new") return;

    const monthValue = from.getMonth() + 1;
    const yearValue = from.getFullYear();
    const monthName = from.toLocaleString("id-ID", { month: "long" });

    setPeriodForm((prev) => ({
      ...prev,
      month: monthValue,
      year: yearValue,
      name: prev.name?.trim() ? prev.name : monthName,
    }));

    setTo((prev) => {
      if (!prev) return endOfMonthOf(from);
      if (prev.getMonth() === from.getMonth() && prev.getFullYear() === from.getFullYear()) {
        return prev;
      }
      return endOfMonthOf(from);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, selectedPeriodId]);

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

  const draftEntriesList = useMemo(() => {
    return CATEGORY_OPTIONS.filter((item) => draftEntries[item.value]).map((item) => ({
      category: item.value,
      label: item.label,
      amount: draftEntries[item.value]!.amount,
      data: draftEntries[item.value]!.data,
    }));
  }, [draftEntries]);

  const totalDraftAmount = draftEntriesList.reduce((sum, entry) => sum + entry.amount, 0);
  const actualRevenueTotal = metrics?.actualRevenueTotal ?? 0;
  const totalOmsetPaid = metrics?.totalOmsetPaid ?? 0;
  const netMarginDisplay = actualRevenueTotal - totalDraftAmount;
  const pinjamModalDisplay = totalDraftAmount > totalOmsetPaid ? totalDraftAmount - totalOmsetPaid : 0;

  const handleSavePlan = async () => {
    if (!from || !to) {
      alert("Periode from/to wajib dipilih");
      return;
    }
    if (!periodForm.name.trim()) {
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
        id: selectedPeriodId && selectedPeriodId !== "new" ? Number(selectedPeriodId) : undefined,
        name: periodForm.name,
        month: periodForm.month,
        year: periodForm.year,
        startDate: from.toISOString(),
        endDate: to.toISOString(),
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
    setSelectedPeriodId(String(data.period.id));
    setDraftEntries(() => {
      const newDraft: PlanDraftState = {};
      data.planEntries.forEach((entry) => {
        newDraft[entry.category] = { amount: entry.amount, data: entry.data };
      });
      return newDraft;
    });
    await Promise.all([loadPlanPeriods(), loadMetrics(data.period.id)]);
    alert("Plan berhasil disimpan");
  };

  const bahanBudget = metrics?.bahanBudget ?? 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Periode From</Label>
          <DateTimePicker value={from} onChange={setFrom} />
        </div>
        <div className="space-y-2">
          <Label>Periode To</Label>
          <DateTimePicker value={to} onChange={setTo} />
        </div>
        <div className="space-y-2">
          <Label>Periode Plan</Label>
          <Select value={selectedPeriodId} onValueChange={(value) => setSelectedPeriodId(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>
            <SelectContent>
              {planPeriods.map((period) => (
                <SelectItem key={period.id} value={String(period.id)}>
                  {period.name} ({period.month}/{period.year})
                </SelectItem>
              ))}
              <SelectItem value="new">+ Periode Baru</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Nama Periode</Label>
          <Input
            value={periodForm.name}
            onChange={(e) => setPeriodForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Contoh: Oktober 2024"
          />
        </div>
        <div className="space-y-2">
          <Label>Bulan</Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={periodForm.month}
            onChange={(e) => setPeriodForm((prev) => ({ ...prev, month: Number(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Tahun</Label>
          <Input
            type="number"
            min={2020}
            value={periodForm.year}
            onChange={(e) => setPeriodForm((prev) => ({ ...prev, year: Number(e.target.value) }))}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Aktual Revenue (Sales)</h2>
          {loadingMetrics && <span className="text-sm text-gray-500">Loading...</span>}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Outlet</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(metrics?.actualRevenueByOutlet || []).map((row) => (
              <TableRow key={row.outlet}>
                <TableCell>{row.outlet}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(actualRevenueTotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label>Tambah Plan Pengeluaran</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={activeCategory ?? ""}
                onValueChange={(value) => setActiveCategory(value as FinanceCategory)}
              >
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
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveCategory(entry.category)}
                    >
                      Hapus
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">Total Plan</TableCell>
              <TableCell />
              <TableCell className="text-right font-semibold">
                {formatCurrency(totalDraftAmount)}
              </TableCell>
              <TableCell />
            </TableRow>
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
              <TableRow key={item.outlet}>
                <TableCell>{item.outlet}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
              </TableRow>
            ))}
            {(!metrics || (metrics.danaTertahan || []).length === 0) && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-sm text-gray-500">
                  Tidak ada dana tertahan
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSavePlan} className="px-6">
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

function PlanEntryDetails({ category, data }: { category: FinanceCategory; data: any }) {
  if (!data) return <span className="text-sm text-gray-500">-</span>;

  switch (category) {
    case "BAHAN":
      return (
        <div className="space-y-1 text-sm">
          <div>Budget: {formatCurrency(data?.budget ?? 0)}</div>
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
          <div className="text-xs text-gray-500 italic">Belum Termasuk Susu</div>
        </div>
      );
    case "PAYROLL":
      return (
        <div className="space-y-1 text-sm">
          <div>Pokok: {formatCurrency(data?.baseSalary ?? 0)}</div>
          <div>Overtime: {formatCurrency(data?.totalOvertime ?? 0)}</div>
          <div>Total Payroll: {formatCurrency(data?.totalPayroll ?? 0)}</div>
          {Array.isArray(data?.overtimeEntries) && data.overtimeEntries.length > 0 && (
            <div>
              <div className="text-xs text-gray-500">Detail Overtime:</div>
              <ul className="text-xs text-gray-600 list-disc list-inside">
                {data.overtimeEntries.map((entry: any, idx: number) => (
                  <li key={`${entry?.name ?? idx}-${idx}`}>
                    {entry?.name}: {formatCurrency(entry?.amount ?? 0)}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
      return <div className="text-sm">Total: {formatCurrency(data?.value ?? 0)}</div>;
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
  const initialData = initial?.data ?? {};
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
  const initialData = initial?.data ?? {};
  const [baseSalary, setBaseSalary] = useState<string>(
    initialData?.baseSalary ? String(initialData.baseSalary) : "8650000",
  );
  const [overtimeEntries, setOvertimeEntries] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.overtimeEntries)
      ? initialData.overtimeEntries.map((item: any) => ({
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
  const initialData = initial?.data ?? {};
  const [items, setItems] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? initialData.items.map((item: any) => ({
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
  const initialData = initial?.data ?? {};
  const [items, setItems] = useState<Array<{ name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? initialData.items.map((item: any) => ({
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
  const initialData = initial?.data ?? {};
  const [items, setItems] = useState<Array<{ type: "PRODUKSI" | "OPERASIONAL"; name: string; amount: string }>>(
    Array.isArray(initialData?.items)
      ? initialData.items.map((item: any) => ({
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
  const initialData = initial?.data ?? {};
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
