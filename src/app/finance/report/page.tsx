"use client";

import { useEffect, useMemo, useState } from "react";
import { FinanceCategory } from "@prisma/client";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { cn } from "../../../lib/utils";

type ReportItem = {
  periodId: number;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  weekId: number | null;
  week: {
    id: number;
    name: string;
    month: number;
    year: number;
    startDate: string;
    endDate: string;
  } | null;
  actualRevenue: number;
  plan: {
    total: number;
    byCategory: Array<{ category: FinanceCategory; amount: number }>;
  };
  actual: {
    total: number;
    byCategory: Array<{ category: FinanceCategory; amount: number }>;
  };
  netProfitPlan: number;
  netProfitActual: number;
};

type ReportResponse = {
  reports: ReportItem[];
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

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatMonthLabel(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1] ?? `Bulan ${month}`;
  return `${name} ${year}`;
}

function formatDateRangeLabel(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "-";
  return `${startDate.toLocaleDateString("id-ID")} - ${endDate.toLocaleDateString("id-ID")}`;
}

export default function FinanceReportPage() {
  const [year, setYear] = useState<string>("");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (year.trim()) query.set("year", year.trim());
      const res = await fetch(`/api/finance/report?${query.toString()}`);
      if (!res.ok) {
        console.error("Failed to load finance report");
        return;
      }
      const data = (await res.json()) as ReportResponse;
      setReports(data.reports || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yearsAvailable = Array.from(new Set(reports.map((item) => item.year))).sort((a, b) => b - a);

  const groupedReports = useMemo(() => {
    const map = new Map<string, { key: string; month: number; year: number; label: string; items: ReportItem[] }>();
    for (const report of reports) {
      const startDate = new Date(report.startDate);
      const derivedMonth = startDate.getMonth() + 1;
      const derivedYear = startDate.getFullYear();
      const month = report.week?.month ?? report.month ?? derivedMonth;
      const yearValue = report.week?.year ?? report.year ?? derivedYear;
      const key = `${yearValue}-${String(month).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, { key, month, year: yearValue, label: formatMonthLabel(month, yearValue), items: [] });
      }
      map.get(key)!.items.push(report);
    }
    const groups = Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
    groups.forEach((group) => {
      group.items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    });
    return groups;
  }, [reports]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Filter Tahun</label>
          <Input
            type="number"
            min="2020"
            placeholder={yearsAvailable[0] ? String(yearsAvailable[0]) : "2024"}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={loadReports} disabled={loading} className="mt-6">
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setYear("");
              loadReports();
            }}
            className="mt-6"
          >
            Reset
          </Button>
        </div>
      </section>

      <section className="space-y-6">
        {groupedReports.length === 0 ? (
          <div className="text-sm text-gray-500">Belum ada data Finance Operations</div>
        ) : (
          groupedReports.map((group) => (
            <div key={group.key} className="space-y-4">
              <h2 className="text-xl font-semibold">{group.label}</h2>
              <div className="space-y-4">
                {group.items.map((report) => (
                  <div key={report.periodId} className="border rounded-lg p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-lg font-semibold">{report.week?.name ?? report.name}</div>
                        <div className="text-xs text-gray-500">{formatDateRangeLabel(report.startDate, report.endDate)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Badge color="green">Actual Revenue {formatCurrency(report.actualRevenue)}</Badge>
                        <Badge color="gray">Plan {formatCurrency(report.plan.total)}</Badge>
                        <Badge color={report.actual.total > report.plan.total ? "red" : "green"}>
                          Actual {formatCurrency(report.actual.total)}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-medium mb-2">Plan Pengeluaran per Kategori</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kategori</TableHead>
                              <TableHead className="text-right">Jumlah</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.plan.byCategory.map((item) => (
                              <TableRow key={item.category}>
                                <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell className="font-semibold">Total</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(report.plan.total)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Actual Pengeluaran per Kategori</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kategori</TableHead>
                              <TableHead className="text-right">Jumlah</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.actual.byCategory.map((item) => (
                              <TableRow key={item.category}>
                                <TableCell>{CATEGORY_LABELS[item.category]}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell className="font-semibold">Total</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(report.actual.total)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 border rounded-md p-3">
                        <div className="text-sm text-gray-500">Net Profit (Actual Revenue - Plan Pengeluaran)</div>
                        <div className={cn("text-xl font-semibold", report.netProfitPlan < 0 && "text-red-600")}>
                          {formatCurrency(report.netProfitPlan)}
                        </div>
                      </div>
                      <div className="space-y-2 border rounded-md p-3">
                        <div className="text-sm text-gray-500">Actual Net Profit (Actual Revenue - Actual Pengeluaran)</div>
                        <div className={cn("text-xl font-semibold", report.netProfitActual < 0 && "text-red-600")}>
                          {formatCurrency(report.netProfitActual)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
