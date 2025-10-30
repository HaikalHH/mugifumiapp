"use client";

import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { DateTimePicker } from "../../../components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

type WeekItem = {
  id: number;
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
};

type WeekFormState = {
  name: string;
  month: number;
  year: number;
  startDate: Date | undefined;
  endDate: Date | undefined;
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

function formatMonthLabel(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1] ?? `Bulan ${month}`;
  return `${name} ${year}`;
}

export default function FinanceWeeksPage() {
  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();
  const [weeks, setWeeks] = useState<WeekItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WeekFormState>({
    name: "",
    month: defaultMonth,
    year: defaultYear,
    startDate: undefined,
    endDate: undefined,
  });

  const loadWeeks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/weeks");
      if (!res.ok) {
        console.error("Failed to load weeks");
        return;
      }
      const data = await res.json();
      const list: WeekItem[] = Array.isArray(data.weeks) ? data.weeks : [];
      list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setWeeks(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeeks();
  }, []);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      alert("Nama minggu wajib diisi");
      return;
    }
    if (!form.startDate || !form.endDate) {
      alert("Pilih tanggal mulai dan selesai");
      return;
    }
    if (form.endDate < form.startDate) {
      alert("Tanggal selesai harus setelah tanggal mulai");
      return;
    }
    if (form.month < 1 || form.month > 12) {
      alert("Bulan harus antara 1 sampai 12");
      return;
    }
    if (form.year < 2000) {
      alert("Tahun tidak valid");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        month: form.month,
        year: form.year,
        startDate: form.startDate.toISOString(),
        endDate: form.endDate.toISOString(),
      };
      const res = await fetch("/api/finance/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menyimpan minggu");
        return;
      }
      setForm((prev) => ({
        name: "",
        month: prev.month,
        year: prev.year,
        startDate: undefined,
        endDate: undefined,
      }));
      await loadWeeks();
      alert("Minggu berhasil ditambahkan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2 space-y-2">
          <Label>Nama Minggu</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Contoh: Week 1 Oktober"
          />
        </div>
        <div className="space-y-2">
          <Label>Bulan</Label>
          <Select
            value={String(form.month)}
            onValueChange={(value) => setForm((prev) => ({ ...prev, month: Number(value) }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tahun</Label>
          <Input
            type="number"
            min={2000}
            value={form.year}
            onChange={(e) => setForm((prev) => ({ ...prev, year: Number(e.target.value) || prev.year }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Tanggal Mulai</Label>
          <DateTimePicker
            value={form.startDate}
            onChange={(value) => setForm((prev) => ({ ...prev, startDate: value ?? undefined }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Tanggal Selesai</Label>
          <DateTimePicker
            value={form.endDate}
            onChange={(value) => setForm((prev) => ({ ...prev, endDate: value ?? undefined }))}
          />
        </div>
        <div className="md:col-span-5 flex gap-3">
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Minggu"}
          </Button>
          <Button variant="outline" onClick={loadWeeks} disabled={loading}>
            {loading ? "Memuat..." : "Refresh"}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Daftar Minggu</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Bulan</TableHead>
              <TableHead>Rentang Tanggal</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeks.map((week) => (
              <TableRow key={week.id}>
                <TableCell>{week.name}</TableCell>
                <TableCell>{formatMonthLabel(week.month, week.year)}</TableCell>
                <TableCell>
                  {new Date(week.startDate).toLocaleDateString("id-ID")} -{" "}
                  {new Date(week.endDate).toLocaleDateString("id-ID")}
                </TableCell>
                <TableCell>{new Date(week.createdAt).toLocaleString("id-ID")}</TableCell>
                <TableCell>{new Date(week.updatedAt).toLocaleString("id-ID")}</TableCell>
              </TableRow>
            ))}
            {weeks.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-gray-500">
                  Belum ada data minggu
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
