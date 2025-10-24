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

type ActualEntryDraft = {
  amount: number;
  data: any;
};

type ActualDraftState = Partial<Record<FinanceCategory, ActualEntryDraft>>;

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

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function FinanceActualPage() {
  const [from, setFrom] = useState<Date | undefined>(startOfCurrentMonth());
  const [to, setTo] = useState<Date | undefined>(endOfCurrentMonth());
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [planPeriods, setPlanPeriods] = useState<PeriodSummary[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [periodInfo, setPeriodInfo] = useState<{ name: string; month: number; year: number }>({
    name: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [planEntries, setPlanEntries] = useState<PlanDetailResponse["planEntries"]>([]);
  const [draftEntries, setDraftEntries] = useState<ActualDraftState>({});
  const [activeCategory, setActiveCategory] = useState<FinanceCategory | null>(null);

  const loadPlanPeriods = async () => {
    const res = await fetch("/api/finance/plan");
    if (!res.ok) return;
    const data = await res.json();
    const periods: PeriodSummary[] = data.periods || [];
    setPlanPeriods(periods);
    if (!selectedPeriodId && periods.length > 0) {
      setSelectedPeriodId(String(periods[0].id));
    }
  };

  const loadPlanDetail = async (periodId: number) => {
    const res = await fetch(`/api/finance/plan?periodId=${periodId}`);
    if (!res.ok) return;
    const data = (await res.json()) as PlanDetailResponse;
    if (data.period) {
      setPeriodInfo({ name: data.period.name, month: data.period.month, year: data.period.year });
      setFrom(new Date(data.period.startDate));
      setTo(new Date(data.period.endDate));
    }
    setPlanEntries(data.planEntries);
    const draft: ActualDraftState = {};
    data.actualEntries.forEach((entry) => {
      draft[entry.category] = { amount: entry.amount, data: entry.data };
    });
    setDraftEntries(draft);
  };

  const loadMetrics = async (periodId: number | null) => {
    if (!from || !to) return;
    const query = new URLSearchParams();
    query.set("from", from.toISOString());
    query.set("to", to.toISOString());
    if (periodId) query.set("periodId", String(periodId));
    const res = await fetch(`/api/finance/metrics?${query.toString()}`);
    if (!res.ok) return;
    const data = (await res.json()) as Metrics;
    setMetrics(data);
    if (periodId) {
      const draft: ActualDraftState = {};
      data.actualEntries?.forEach((entry) => {
        draft[entry.category] = { amount: entry.amount, data: entry.data };
      });
      setDraftEntries((prev) => ({ ...prev, ...draft }));
      if (data.planEntries) {
        setPlanEntries(data.planEntries);
      }
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

  const handleCategorySubmit = (category: FinanceCategory, entry: ActualEntryDraft) => {
    setDraftEntries((prev) => ({ ...prev, [category]: entry }));
    setActiveCategory(null);
  };

  const draftList = useMemo(() => {
    return CATEGORY_OPTIONS.filter(
      (item) => planEntries.some((plan) => plan.category === item.value) || draftEntries[item.value],
    ).map((item) => {
      const plan = planEntries.find((p) => p.category === item.value);
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

  const handleSaveActual = async () => {
    if (!from || !to) {
      alert("Periode from/to wajib dipilih");
      return;
    }
    if (!selectedPeriodId || selectedPeriodId === "new") {
      alert("Pilih periode plan terlebih dahulu");
      return;
    }
    const periodId = Number(selectedPeriodId);
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
          id: periodId,
          name: periodInfo.name,
          month: periodInfo.month,
          year: periodInfo.year,
          startDate: from.toISOString(),
          endDate: to.toISOString(),
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
    const draft: ActualDraftState = {};
    data.actualEntries.forEach((entry) => {
      draft[entry.category] = { amount: entry.amount, data: entry.data };
    });
    setDraftEntries(draft);
    await loadMetrics(periodId);
    alert("Actual berhasil disimpan");
  };

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
          <Label>Pilih Periode Plan</Label>
          <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Periode" />
            </SelectTrigger>
            <SelectContent>
              {planPeriods.map((period) => (
                <SelectItem key={period.id} value={String(period.id)}>
                  {period.name} ({period.month}/{period.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Perbandingan Plan vs Actual</h2>
          <div className="flex items-center gap-2">
            <Select
              value={activeCategory ?? ""}
              onValueChange={(value) => setActiveCategory(value as FinanceCategory)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Tambah Actual kategori" />
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
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell>{formatCurrency(totalPlan)}</TableCell>
              <TableCell>{formatCurrency(totalActual)}</TableCell>
              <TableCell className="text-right">
                {totalPlan > 0 ? `${((totalActual / totalPlan) * 100).toFixed(1)}%` : "-"}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Actual Revenue (Sales)</div>
          <div className="text-lg font-semibold">{formatCurrency(actualRevenueTotal)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Total Plan</div>
          <div className="text-lg font-semibold">{formatCurrency(totalPlan)}</div>
        </div>
        <div className="space-y-1">
          <div className="text-sm text-gray-500">Total Actual Pengeluaran</div>
          <div className="text-lg font-semibold">{formatCurrency(totalActual)}</div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-sm text-gray-500">Net Profit (Actual Revenue - Plan)</div>
        <div className={cn("text-lg font-semibold", netProfitPlan < 0 && "text-red-600")}>
          {formatCurrency(netProfitPlan)}
        </div>
        <div className="text-sm text-gray-500">Actual Net Profit (Actual Revenue - Actual Pengeluaran)</div>
        <div className={cn("text-lg font-semibold", netProfitActual < 0 && "text-red-600")}>
          {formatCurrency(netProfitActual)}
        </div>
        <div className="text-sm text-gray-500">Pinjam Modal</div>
        <div className={cn("text-lg font-semibold", pinjamModalDisplay > 0 && "text-red-600")}>
          {formatCurrency(pinjamModalDisplay)}
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={handleSaveActual} className="px-6">
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
  planBudget: number;
  onCancel: () => void;
  onSubmit: (entry: ActualEntryDraft) => void;
}) {
  const initialData = initial?.data ?? {};
  const [value, setValue] = useState<string>(
    initialData?.kebutuhan ? String(initialData.kebutuhan) : initial ? String(initial.amount) : "",
  );
  const kebutuhanValue = Math.round(Number(value || 0));
  const difference = kebutuhanValue - planBudget;

  const handleSubmit = () => {
    onSubmit({
      amount: kebutuhanValue,
      data: {
        kebutuhan: kebutuhanValue,
        planBudget,
        difference,
      },
    });
    onCancel();
  };

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Plan Budget</Label>
          <Input value={planBudget} readOnly className="bg-gray-50" />
        </div>
        <div className="space-y-1">
          <Label>Actual Kebutuhan (Rp)</Label>
          <Input type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className={cn("text-sm font-medium", difference > 0 ? "text-red-600" : "text-green-600")}>
          {difference > 0 ? "Over Plan" : "Sisa"} {formatCurrency(Math.abs(difference))}
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
