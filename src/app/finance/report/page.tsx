"use client";

import { useEffect, useState } from "react";
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

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
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

      <section className="space-y-4">
        {reports.length === 0 && (
          <div className="text-sm text-gray-500">Belum ada data Finance Operations</div>
        )}
        {reports.map((report) => (
          <div key={report.periodId} className="border rounded-lg p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">
                  {report.name} ({report.month}/{report.year})
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(report.startDate).toLocaleDateString()} -{" "}
                  {new Date(report.endDate).toLocaleDateString()}
                </div>
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
      </section>
    </div>
  );
}
