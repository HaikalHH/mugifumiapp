"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { DateTimePicker } from "../../components/ui/date-picker";
import { getStartOfDayJakarta, getEndOfDayJakarta } from "../../lib/timezone";

type Sale = { id: number; outlet: string; location: string; orderDate: string; customer?: string | null; actPayout?: number | null; shipDate?: string | null };

import { useAuth, lockedLocation } from "../providers";

function getInitialLocation(): string {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("mf_user");
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      const locked = lockedLocation(parsed);
      if (locked) return locked;
    } catch {}
  }
  return "Bandung";
}

export default function SalesPage() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [outlet, setOutlet] = useState("WhatsApp");
  const [location, setLocation] = useState<string>(() => getInitialLocation());
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal form state
  const [form, setForm] = useState({
    customer: "",
    status: "ordered",
    orderDate: "", // required; keep empty until user selects
    shipDate: "",
    estPayout: "", // computed and shown read-only when items exist
    actPayout: "",
    discount: "",
  });
  const [scanInput, setScanInput] = useState("");
  const [barcodes, setBarcodes] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<{ subtotal: number; discountPct: number; total: number } | null>(null);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const loadSales = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (from) {
      const fromJakarta = getStartOfDayJakarta(from);
      params.set("from", fromJakarta.toISOString());
    }
    if (to) {
      const toJakarta = getEndOfDayJakarta(to);
      params.set("to", toJakarta.toISOString());
    }
    const res = await fetch(`/api/sales?${params.toString()}`);
    const data = await res.json();
    setSales(data.rows || []);
    setTotal(data.total || 0);
  }, [page, from, to]);

  useEffect(() => { loadSales(); }, [loadSales]);

  // lock location for Bandung/Jakarta
  useEffect(() => {
    const locked = lockedLocation(user);
    if (locked) setLocation(locked);
  }, [user]);

  const openModal = () => {
    setForm({
      customer: "",
      status: (() => {
        const key = outlet.toLowerCase();
        if (key === "tokopedia" || key === "shopee" || key === "whatsapp" || key === "free") return "ordered";
        if (key === "wholesale" || key === "complain") return "shipping";
        if (key === "cafe") return "Display";
        return "ordered";
      })(),
      orderDate: "",
      shipDate: "",
      estPayout: "",
      actPayout: "",
      discount: "",
    });
    setBarcodes([]);
    setScanInput("");
    setIsModalOpen(true);
  };

  const addScan = () => {
    const code = scanInput.trim();
    if (!code) { setError("Barcode tidak boleh kosong"); return; }
    if (barcodes.some((b) => b.toUpperCase() === code.toUpperCase())) {
      setError("Barcode sudah ditambahkan");
      return;
    }
    setError("");
    setBarcodes((prev) => [...prev, code]);
    setScanInput("");
  };

  const removeScan = (idx: number) => {
    setBarcodes((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitSale = async () => {
    // Basic per-outlet validation
    setError("");
    const key = outlet.toLowerCase();
    if ((key === "tokopedia" || key === "shopee" || key === "whatsapp" || key === "free" || key === "wholesale" || key === "complain" || key === "cafe") && !form.customer.trim()) {
      setError("Customer wajib diisi");
      return;
    }
    if ((key === "tokopedia" || key === "shopee" || key === "whatsapp" || key === "free" || key === "wholesale" || key === "complain" || key === "cafe") && barcodes.length === 0) {
      setError("Tambah minimal 1 item terlebih dahulu");
      return;
    }
    // Order date is required for creation
    if (!form.orderDate) {
      setError("Order date wajib diisi");
      return;
    }
    // Ship date is optional for all outlets

    const payload: any = {
      outlet,
      location,
      customer: form.customer || undefined,
      status: form.status || undefined,
      orderDate: form.orderDate ? new Date(form.orderDate + "T00:00:00").toISOString() : undefined,
      shipDate: form.shipDate ? new Date(form.shipDate + "T00:00:00").toISOString() : undefined,
      // estPayout computed server-side; actPayout is numeric amount (optional)
      actPayout: form.actPayout ? Number(form.actPayout) : undefined,
      discount: form.discount ? Number(form.discount) : undefined,
      items: barcodes,
    };
    setIsSubmitting(true);
    const res = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setIsModalOpen(false);
      loadSales();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Failed to create sale");
    }
    setIsSubmitting(false);
  };

  // Recompute estimate when inputs change
  useEffect(() => {
    const run = async () => {
      if (barcodes.length === 0) { setEstimate(null); return; }
      const res = await fetch("/api/sales/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barcodes, location, outlet, discount: (outlet === "WhatsApp" || outlet === "Cafe") && form.discount ? Number(form.discount) : null }) });
      if (res.ok) {
        setEstimate(await res.json());
      }
    };
    run();
  }, [barcodes, location, outlet, form.discount]);

  const deleteSale = async (id: number) => {
    await fetch(`/api/sales/${id}`, { method: "DELETE" });
    loadSales();
  };

  const [editModal, setEditModal] = useState<{ open: boolean; sale: any | null; items: any[] }>({ open: false, sale: null, items: [] });
  const [editSearch, setEditSearch] = useState("");

  const openEdit = async (id: number) => {
    const res = await fetch(`/api/sales/${id}`);
    const sale = await res.json();
    const items = await fetch(`/api/sales/${id}/items`).then((r) => r.json());
    setEditModal({ open: true, sale, items });
    setEditSearch("");
  };

  const updateItem = async (itemId: number, updates: any) => {
    await fetch(`/api/sales/items/${itemId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    if (editModal.sale) openEdit(editModal.sale.id);
  };

  const removeItem = async (itemId: number) => {
    await fetch(`/api/sales/items/${itemId}`, { method: "DELETE" });
    if (editModal.sale) openEdit(editModal.sale.id);
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Sales</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Outlet</Label>
          <Select value={outlet} onValueChange={setOutlet}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Outlet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tokopedia">Tokopedia</SelectItem>
              <SelectItem value="Shopee">Shopee</SelectItem>
              <SelectItem value="WhatsApp">WhatsApp</SelectItem>
              <SelectItem value="Cafe">Cafe</SelectItem>
              <SelectItem value="Wholesale">Wholesale</SelectItem>
              <SelectItem value="Complain">Complain</SelectItem>
              <SelectItem value="Free">Free</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Location</Label>
          <Select value={location} onValueChange={(v) => setLocation(v)} disabled={Boolean(lockedLocation(user))}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Lokasi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bandung">Bandung</SelectItem>
              <SelectItem value="Jakarta">Jakarta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Periode From</Label>
          <DateTimePicker
            value={from}
            onChange={(date) => { setPage(1); setFrom(date); }}
            placeholder="Select start date"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Periode To</Label>
          <DateTimePicker
            value={to}
            onChange={(date) => { setPage(1); setTo(date); }}
            placeholder="Select end date"
          />
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={openModal}>Create Sale</Button>
        <Button variant="outline" onClick={() => {
          setFrom(undefined);
          setTo(undefined);
          setPage(1);
        }}>
          Clear Filters
        </Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Sale - {outlet} ({location})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(outlet === "Tokopedia" || outlet === "Shopee" || outlet === "WhatsApp" || outlet === "Free" || outlet === "Wholesale" || outlet === "Complain" || outlet === "Cafe") && (
              <div className="flex flex-col gap-1">
                <Label>{(outlet === "Tokopedia" || outlet === "Shopee") ? "ID Pesanan *" : "Customer *"}</Label>
                <Input placeholder={(outlet === "Tokopedia" || outlet === "Shopee") ? "Masukkan ID Pesanan" : "Customer"} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const key = outlet.toLowerCase();
                    const options = ["ordered", "shipping", "cancel", "refund"] as const;
                    const cafe = ["Display", "Waste", "Terjual"] as const;
                    return (
                      <>
                        {options.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                        {key === "cafe" && cafe.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Order Date</Label>
              <DateTimePicker
                value={form.orderDate ? new Date(form.orderDate) : undefined}
                onChange={(date) => {
                  if (date) {
                    // Format as YYYY-MM-DD for date input compatibility
                    const year = date.getFullYear()
                    const month = String(date.getMonth() + 1).padStart(2, '0')
                    const day = String(date.getDate()).padStart(2, '0')
                    setForm({ ...form, orderDate: `${year}-${month}-${day}` })
                  } else {
                    setForm({ ...form, orderDate: "" })
                  }
                }}
                placeholder="Select order date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Ship Date</Label>
              <DateTimePicker
                value={form.shipDate ? new Date(form.shipDate) : undefined}
                onChange={(date) => {
                  if (date) {
                    // Format as YYYY-MM-DD for date input compatibility
                    const year = date.getFullYear()
                    const month = String(date.getMonth() + 1).padStart(2, '0')
                    const day = String(date.getDate()).padStart(2, '0')
                    setForm({ ...form, shipDate: `${year}-${month}-${day}` })
                  } else {
                    setForm({ ...form, shipDate: "" })
                  }
                }}
                placeholder="Select ship date"
              />
            </div>
            {(outlet === "Tokopedia" || outlet === "Shopee" || outlet === "Wholesale" || outlet === "Complain") && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>Estimasi Total (Rp)</Label>
                  <Input className="bg-gray-50" value={estimate ? estimate.total.toLocaleString("id-ID") : ""} readOnly />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Potongan % (auto)</Label>
                  <Input className="bg-gray-50" value={(function(){
                    const est = estimate?.total || 0; const act = Number(form.actPayout||0);
                    if (!est || !act) return "";
                    const pct = Math.max(0, Math.round(((est - act) / est) * 1000) / 10);
                    return String(pct);
                  })()} readOnly />
                </div>
              </>
            )}
            {(outlet === "Tokopedia" || outlet === "Shopee" || outlet === "Wholesale" || outlet === "Complain") && (
              <div className="flex flex-col gap-1">
                <Label>Actual diterima (Rp)</Label>
                <Input type="number" placeholder="e.g. 100000" value={form.actPayout} onChange={(e) => setForm({ ...form, actPayout: e.target.value })} />
              </div>
            )}
            {(outlet === "WhatsApp" || outlet === "Cafe") && (
              <div className="flex flex-col gap-1">
                <Label>Potongan %</Label>
                <Input type="number" placeholder="e.g. 10" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="font-medium">Add Items</div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="flex flex-col gap-1 md:col-span-5">
                <Label>Barcode</Label>
                <Input placeholder="Scan barcode" value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addScan(); } }} />
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={addScan} type="button">Add</Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Barcode</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {barcodes.map((b, idx) => (
                  <TableRow key={`${b}-${idx}`}>
                    <TableCell>{b}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => removeScan(idx)}>Remove</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} type="button" disabled={isSubmitting}>Cancel</Button>
            <Button className="disabled:opacity-50" onClick={submitSale} type="button" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h2 className="font-medium mb-2">Recent Sales</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">ID</TableHead>
              <TableHead className="text-left">Outlet</TableHead>
              <TableHead className="text-left">Location</TableHead>
              <TableHead className="text-left">Customer</TableHead>
              <TableHead className="text-left">Order Date</TableHead>
              <TableHead className="text-left">Shipping Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{s.outlet}</span>
                    {(() => {
                      const key = String(s.outlet || "").toLowerCase();
                      if (key === "tokopedia" || key === "shopee" || key === "wholesale" || key === "complain") {
                        const filled = typeof s.actPayout === "number" && !Number.isNaN(s.actPayout);
                        return (
                          <Badge color={filled ? "green" : "red"}>
                            {filled ? "Paid" : "Not Paid"}
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </TableCell>
                <TableCell>{s.location}</TableCell>
                <TableCell>{s.customer || "-"}</TableCell>
                <TableCell>{new Date(s.orderDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge color={s.shipDate ? "green" : "red"}>
                    {s.shipDate ? "Telah Dikirim" : "Belum Dikirim"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex gap-3 justify-center">
                    <Button variant="link" className="p-0 h-auto" onClick={() => openEdit(s.id)}>Edit</Button>
                    {user?.role === "Admin" && (
                      <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => deleteSale(s.id)}>Delete</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-gray-600">Page {page} / {Math.max(1, Math.ceil(total / 10))}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
            <Button variant="outline" onClick={() => setPage((p) => (p * 10 < total ? p + 1 : p))} disabled={page * 10 >= total}>Next</Button>
          </div>
        </div>
      </div>

      <Dialog open={editModal.open} onOpenChange={(open) => { if (!open) setEditModal({ open: false, sale: null, items: [] }); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editModal.sale ? (
                <>Edit Sale #{editModal.sale.id} - {editModal.sale.outlet} ({editModal.sale.location})</>
              ) : (
                <>Edit Sale</>
              )}
            </DialogTitle>
          </DialogHeader>
          {editModal.sale && (
            <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <Label>Search Barcode</Label>
              <Input placeholder="Cari barcode" value={editSearch} onChange={(e) => setEditSearch(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <Label>Outlet</Label>
                <Select
                  value={editModal.sale.outlet}
                  onValueChange={(v) => setEditModal((prev) => (prev.sale ? { ...prev, sale: { ...prev.sale, outlet: v } } : prev))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tokopedia">Tokopedia</SelectItem>
                    <SelectItem value="Shopee">Shopee</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Cafe">Cafe</SelectItem>
                    <SelectItem value="Wholesale">Wholesale</SelectItem>
                    <SelectItem value="Complain">Complain</SelectItem>
                    <SelectItem value="Free">Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Location</Label>
                <Select
                  value={editModal.sale.location}
                  onValueChange={(v) => setEditModal((prev) => (prev.sale ? { ...prev, sale: { ...prev.sale, location: v } } : prev))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bandung">Bandung</SelectItem>
                    <SelectItem value="Jakarta">Jakarta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(editModal.sale.outlet === "Tokopedia" || editModal.sale.outlet === "Shopee" || editModal.sale.outlet === "WhatsApp" || editModal.sale.outlet === "Free" || editModal.sale.outlet === "Wholesale" || editModal.sale.outlet === "Complain" || editModal.sale.outlet === "Cafe") && (
                <div className="flex flex-col gap-1">
                  <Label>{(editModal.sale.outlet === "Tokopedia" || editModal.sale.outlet === "Shopee") ? "ID Pesanan *" : "Customer *"}</Label>
                  <Input placeholder={(editModal.sale.outlet === "Tokopedia" || editModal.sale.outlet === "Shopee") ? "Masukkan ID Pesanan" : "Customer"} value={editModal.sale.customer || ""} onChange={(e) => setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, customer: e.target.value } } : prev)} />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <Label>Status</Label>
                <Select
                  value={editModal.sale.status}
                  onValueChange={(v) => setEditModal((prev) => (prev.sale ? { ...prev, sale: { ...prev.sale, status: v } } : prev))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const key = String(editModal.sale.outlet || "").toLowerCase();
                      const base = ["ordered", "shipping", "cancel", "refund"] as const;
                      const cafe = ["Display", "Waste", "Terjual"] as const;
                      return (
                        <>
                          {base.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                          {key === "cafe" && cafe.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Order Date</Label>
                <DateTimePicker
                  value={new Date(editModal.sale.orderDate)}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      const hours = String(date.getHours()).padStart(2, '0')
                      const minutes = String(date.getMinutes()).padStart(2, '0')
                      const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`
                      setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, orderDate: formattedDate } } : prev)
                    } else {
                      setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, orderDate: "" } } : prev)
                    }
                  }}
                  placeholder="Select order date"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Ship Date</Label>
                <DateTimePicker
                  value={editModal.sale.shipDate ? new Date(editModal.sale.shipDate) : undefined}
                  onChange={(date) => {
                    if (date) {
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      const hours = String(date.getHours()).padStart(2, '0')
                      const minutes = String(date.getMinutes()).padStart(2, '0')
                      const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`
                      setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, shipDate: formattedDate } } : prev)
                    } else {
                      setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, shipDate: null } } : prev)
                    }
                  }}
                  placeholder="Select ship date"
                />
              </div>
              {(editModal.sale.outlet === "Tokopedia" || editModal.sale.outlet === "Shopee" || editModal.sale.outlet === "Wholesale" || editModal.sale.outlet === "Complain") && (
                <div className="flex flex-col gap-1">
                  <Label>Est Payout</Label>
                  <Input type="number" value={editModal.sale.estPayout ?? ""} onChange={(e) => setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, estPayout: e.target.value === "" ? null : Number(e.target.value) } } : prev)} />
                </div>
              )}
              {(editModal.sale.outlet === "Tokopedia" || editModal.sale.outlet === "Shopee" || editModal.sale.outlet === "Wholesale" || editModal.sale.outlet === "Complain") && (
                <div className="flex flex-col gap-1">
                  <Label>Actual Payout</Label>
                  <Input type="number" value={editModal.sale.actPayout ?? ""} onChange={(e) => setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, actPayout: e.target.value === "" ? null : Number(e.target.value) } } : prev)} />
                </div>
              )}
              {(editModal.sale.outlet === "WhatsApp" || editModal.sale.outlet === "Cafe" || editModal.sale.outlet === "Wholesale" || editModal.sale.outlet === "Complain") && (
                <div className="flex flex-col gap-1">
                  <Label>Discount %</Label>
                  <Input type="number" placeholder="Discount %" value={editModal.sale.discount ?? ""} onChange={(e) => setEditModal((prev) => prev.sale ? { ...prev, sale: { ...prev.sale, discount: e.target.value === "" ? null : Number(e.target.value) } } : prev)} />
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={async () => {
                const payload: any = {
                  outlet: editModal.sale.outlet,
                  location: editModal.sale.location,
                  customer: editModal.sale.customer || undefined,
                  status: editModal.sale.status,
                  orderDate: editModal.sale.orderDate ? new Date(editModal.sale.orderDate).toISOString() : undefined,
                  shipDate: editModal.sale.shipDate ? new Date(editModal.sale.shipDate).toISOString() : null,
                  estPayout: editModal.sale.estPayout ?? null,
                  actPayout: editModal.sale.actPayout ?? null,
                  discount: editModal.sale.discount ?? null,
                };
                const res = await fetch(`/api/sales/${editModal.sale.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                if (res.ok) {
                  setEditModal({ open: false, sale: null, items: [] });
                  loadSales();
                }
              }}>Save Header</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Barcode</TableHead>
                  <TableHead className="text-right">Price (Rp)</TableHead>
                  {editModal.sale.outlet === "Cafe" && (<TableHead className="text-left">Status</TableHead>)}
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editModal.items.filter((it) => !editSearch || it.barcode.toLowerCase().includes(editSearch.toLowerCase())).map((it) => {
                  const outletKey = String(editModal.sale.outlet || "").toLowerCase();
                  const discountPct = typeof editModal.sale.discount === "number" ? editModal.sale.discount : null;
                  let displayPrice = it.price;
                  if ((outletKey === "whatsapp" || outletKey === "cafe" || outletKey === "wholesale" || outletKey === "complain") && typeof discountPct === "number") {
                    displayPrice = Math.round(it.price * (1 - discountPct / 100));
                  } else if ((outletKey === "tokopedia" || outletKey === "shopee" || outletKey === "wholesale" || outletKey === "complain") && typeof editModal.sale.estPayout === "number" && typeof editModal.sale.actPayout === "number" && editModal.sale.estPayout > 0) {
                    const ratio = Math.max(0, Math.min(1, editModal.sale.actPayout / editModal.sale.estPayout));
                    displayPrice = Math.round(it.price * ratio);
                  }
                  return (
                    <TableRow key={it.id}>
                      <TableCell>{it.barcode}</TableCell>
                      <TableCell className="text-right">{displayPrice.toLocaleString("id-ID")}</TableCell>
                    {editModal.sale.outlet === "Cafe" && (
                      <TableCell>
                        <Select
                          value={it.status || ""}
                          onValueChange={(v) => updateItem(it.id, { status: v || null })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">-</SelectItem>
                            <SelectItem value="Display">Display</SelectItem>
                            <SelectItem value="Waste">Waste</SelectItem>
                            <SelectItem value="Terjual">Terjual</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                      <TableCell className="text-center">{user?.role === "Admin" && (<Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => removeItem(it.id)}>Delete</Button>)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
