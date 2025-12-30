"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { DateTimePicker } from "../../components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { useAuth, lockedLocation, hasRole } from "../providers";
import { toUTCForJakarta } from "../../lib/timezone";

type Product = { id: number; code: string; name: string; price: number };
type ProductWithSource = Product & { source: "B2B" | "Retail" };
type OrderRow = {
  id: number;
  outlet: string;
  customer?: string | null;
  status: string;
  orderDate: string;
  location: string;
  discount?: number | null;
  totalAmount?: number | null;
  items: Array<{
    id: number;
    productId: number | null;
    retailProductId?: number | null;
    productSource?: "B2B" | "Retail";
    quantity: number;
    price: number;
    product?: Product;
    retailProduct?: Product;
    barcode?: string | null;
  }>;
};

type OrderStatus = "PAID" | "NOT PAID";
const ORDER_STATUS_OPTIONS: OrderStatus[] = ["PAID", "NOT PAID"];

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

export default function OrdersB2BPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [viewMode, setViewMode] = useState(false);

  const [products, setProducts] = useState<ProductWithSource[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [retailProducts, setRetailProducts] = useState<ProductWithSource[]>([]);
  const [retailProductsLoading, setRetailProductsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [outlet, setOutlet] = useState<"Wholesale" | "Cafe">("Wholesale");
  const [location, setLocation] = useState<string>(() => getInitialLocation());
  const [form, setForm] = useState({
    customer: "",
    status: "PAID" as OrderStatus,
    orderDate: null as Date | null,
    discount: "",
    actPayout: "",
  });
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [selectedSource, setSelectedSource] = useState<"B2B" | "Retail">("B2B");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<Array<{ product: ProductWithSource; quantity: number; barcodes?: string[] }>>([]);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeInputs, setBarcodeInputs] = useState<Record<number, string[]>>({});
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (from) params.set("from", toUTCForJakarta(from).toISOString());
    if (to) params.set("to", toUTCForJakarta(to).toISOString());
    const res = await fetch(`/api/b2b/orders?${params.toString()}`);
    const data = await res.json();
    setOrders(data.rows || []);
    setTotal(data.total || 0);
  }, [page, from, to]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setRetailProductsLoading(true);
    try {
      const [b2bRes, retailRes] = await Promise.all([
        fetch("/api/b2b/products"),
        fetch("/api/products"),
      ]);
      const b2bData = await b2bRes.json().catch(() => []);
      const retailData = await retailRes.json().catch(() => []);
      setProducts(Array.isArray(b2bData) ? b2bData.map((p: any) => ({ ...p, source: "B2B" as const })) : []);
      setRetailProducts(Array.isArray(retailData) ? retailData.map((p: any) => ({ ...p, source: "Retail" as const })) : []);
    } catch {
      setProducts([]);
      setRetailProducts([]);
    } finally {
      setProductsLoading(false);
      setRetailProductsLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    const locked = lockedLocation(user);
    if (locked) setLocation(locked);
  }, [user]);

  const addItem = () => {
    const pid = Number(selectedProductId);
    const sourceList = selectedSource === "B2B" ? products : retailProducts;
    const product = sourceList.find((p) => p.id === pid);
    if (!product) {
      setError("Pilih produk terlebih dahulu");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity minimal 1");
      return;
    }
    const effectiveQty = quantity;
    const barcodeArr = selectedSource === "Retail" ? undefined : undefined;
    setError("");
    setItems((prev) => {
      const existingIndex = prev.findIndex((it) => it.product.id === product.id && it.product.source === product.source && (it.barcodes?.join(",") || "") === (barcodeArr?.join(",") || ""));
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + effectiveQty };
        return next;
      }
      return [...prev, { product, quantity: effectiveQty, barcodes: barcodeArr }];
    });
    setQuantity(1);
    setSelectedProductId("");
  };

  const openOrder = async (id: number, mode: "view" | "edit") => {
    try {
      const res = await fetch(`/api/b2b/orders/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to load order");
        return;
      }
      setOutlet(data.outlet as "Wholesale" | "Cafe");
      setLocation(data.location || "Bandung");
      setForm({
        customer: data.customer || "",
        status: (data.status as OrderStatus) || "PAID",
        orderDate: data.orderDate ? new Date(data.orderDate) : null,
        discount: data.discount != null ? String(data.discount) : "",
        actPayout: data.actPayout != null ? String(data.actPayout) : "",
      });
      setItems((data.items || []).map((it: any) => {
        const src = (String(it.productSource || it.source || "B2B").toUpperCase() === "RETAIL") ? "Retail" : "B2B";
        const productData = src === "B2B" ? it.product : it.retailProduct;
        const safeProduct: ProductWithSource = productData
          ? { ...productData, source: src }
          : {
              id: (it.productId ?? it.retailProductId ?? 0),
              code: "-",
              name: "Unknown",
              price: it.price ?? 0,
              source: src,
            };
        const barcodesArr = it.barcode ? [it.barcode] : (Array.isArray(it.barcodes) ? it.barcodes : []);
        return {
          product: safeProduct,
          quantity: it.quantity,
          barcodes: barcodesArr,
        };
      }));
      setEditingOrderId(id);
      setViewMode(mode === "view");
      setIsModalOpen(true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load order");
    }
  };

  const deleteOrder = async (id: number) => {
    if (!confirm("Delete this order?")) return;
    try {
      const res = await fetch(`/api/b2b/orders/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Failed to delete order");
        return;
      }
      loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const subtotal = items.reduce((acc, it) => {
      const price = it.product?.price ?? 0;
      return acc + price * it.quantity;
    }, 0);
    const disc = form.discount ? Number(form.discount) : 0;
    return disc > 0 ? Math.round(subtotal * (1 - disc / 100)) : subtotal;
  };

  const openBarcodeModal = () => {
    const defaults: Record<number, string[]> = {};
    items.forEach((it, idx) => {
      if (it.product.source === "Retail") {
        if (it.barcodes?.length === it.quantity) {
          defaults[idx] = it.barcodes;
        } else {
          defaults[idx] = Array.from({ length: it.quantity }, () => "");
        }
      }
    });
    setBarcodeInputs(defaults);
    setBarcodeModalOpen(true);
  };

  const confirmBarcodesAndSubmit = async () => {
    const updated: typeof items = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.product.source === "Retail") {
        const codes = (barcodeInputs[i] || []).map((b) => b.trim().toUpperCase()).filter(Boolean);
        if (codes.length !== it.quantity) {
          setError(`Barcode untuk ${it.product.name} harus berjumlah ${it.quantity}`);
          return;
        }
        updated.push({ ...it, barcodes: codes });
      } else {
        updated.push(it);
      }
    }
    // client-side validation to inventory
    try {
      const payload = {
        location,
        items: updated
          .filter((it) => it.product.source === "Retail")
          .map((it) => ({ productId: it.product.id, barcodes: it.barcodes || [] })),
      };
      const res = await fetch("/api/b2b/orders/validate-barcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Barcode tidak valid");
        return;
      }
    } catch {
      setError("Gagal validasi barcode");
      return;
    }
    setItems(updated);
    setBarcodeModalOpen(false);
    submitOrder();
  };

  const submitOrder = async () => {
    setError("");
    if (viewMode) {
      setIsModalOpen(false);
      return;
    }
    if (!form.customer.trim()) {
      setError("Customer wajib diisi");
      return;
    }
    if (!form.orderDate) {
      setError("Order Date wajib diisi");
      return;
    }
    if (items.length === 0) {
      setError("Tambah minimal 1 item");
      return;
    }
    // Ensure retail items have barcode
    const retailMissing = items.some((it) => it.product.source === "Retail" && !(it.barcode && it.barcode.trim()));
    if (retailMissing) {
      setError("Lengkapi barcode untuk semua produk retail");
      return;
    }

    const payload = {
      outlet,
      location,
      customer: form.customer,
      status: form.status,
      orderDate: toUTCForJakarta(form.orderDate).toISOString(),
      discount: form.discount ? Number(form.discount) : null,
      actPayout: form.actPayout ? Number(form.actPayout) : null,
      items: items.map((it) => ({
        productId: it.product.id,
        quantity: it.quantity,
        productSource: it.product.source,
        barcodes: it.product.source === "Retail" ? (it.barcodes || []) : undefined,
      })),
    };

    setIsSubmitting(true);
    const url = editingOrderId ? `/api/b2b/orders/${editingOrderId}` : "/api/b2b/orders";
    const method = editingOrderId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setIsModalOpen(false);
      setItems([]);
      setForm({ customer: "", status: "PAID", orderDate: null, discount: "", actPayout: "" });
      setEditingOrderId(null);
      setViewMode(false);
      loadOrders();
    } else {
      setError(data?.error || "Failed to create B2B order");
    }
    setIsSubmitting(false);
  };

  const allowed = user && (hasRole(user, "Sales") || hasRole(user, "Admin") || hasRole(user, "Manager"));
  if (!allowed) {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Orders B2B</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Outlet</Label>
          <Select value={outlet} onValueChange={(v) => setOutlet(v as "Wholesale" | "Cafe")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Wholesale">Wholesale</SelectItem>
              <SelectItem value="Cafe">Cafe</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Location</Label>
          <Select value={location} onValueChange={setLocation} disabled={Boolean(lockedLocation(user)) && !hasRole(user, "BDGSales")}>
            <SelectTrigger><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Bandung">Bandung</SelectItem>
              <SelectItem value="Jakarta">Jakarta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Periode From</Label>
          <DateTimePicker value={from} onChange={(date) => { setPage(1); setFrom(date); }} placeholder="Select start date" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Periode To</Label>
          <DateTimePicker value={to} onChange={(date) => { setPage(1); setTo(date); }} placeholder="Select end date" />
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => setIsModalOpen(true)}>Create B2B Order</Button>
        <Button variant="outline" onClick={() => { setFrom(undefined); setTo(undefined); setPage(1); }}>Clear Filters</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Outlet</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-center">Items</TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell>{o.id}</TableCell>
              <TableCell>{o.outlet}</TableCell>
              <TableCell>{o.customer || "-"}</TableCell>
              <TableCell>{new Date(o.orderDate).toLocaleDateString("id-ID")}</TableCell>
              <TableCell className="text-right">{(o.totalAmount ?? 0).toLocaleString("id-ID")}</TableCell>
              <TableCell className="text-center">{o.items?.length || 0}</TableCell>
              <TableCell className="text-center">
                <div className="flex gap-2 justify-center">
                  <Button variant="link" className="p-0 h-auto" onClick={() => openOrder(o.id, "view")}>View</Button>
                  <Button variant="link" className="p-0 h-auto" onClick={() => openOrder(o.id, "edit")}>Edit</Button>
                  <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => deleteOrder(o.id)}>Delete</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="text-sm text-gray-600">Total: {total}</div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewMode ? "View B2B Order" : editingOrderId ? `Edit B2B Order #${editingOrderId}` : "Create B2B Order"} - {outlet} ({location})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Customer *</Label>
              <Input value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} disabled={viewMode} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as OrderStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Order Date</Label>
              <DateTimePicker value={form.orderDate || undefined} onChange={(d) => setForm({ ...form, orderDate: d || null })} placeholder="Select order date" disabled={viewMode} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Discount %</Label>
              <Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} disabled={viewMode} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Actual diterima (opsional)</Label>
              <Input type="number" value={form.actPayout} onChange={(e) => setForm({ ...form, actPayout: e.target.value })} disabled={viewMode} />
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">Items</div>
              {!viewMode && <Button type="button" onClick={addItem}>Add</Button>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              <div className="flex flex-col gap-1">
                <Label>Master Data</Label>
                <Select
                  value={selectedSource}
                  onValueChange={(v) => {
                    const val = v as "B2B" | "Retail";
                    setSelectedSource(val);
                    setSelectedProductId("");
                    if (val === "Retail") setQuantity(1);
                  }}
                  disabled={viewMode}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2B">Products B2B</SelectItem>
                    <SelectItem value="Retail">Products (Inventory)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Product</Label>
                <Select value={selectedProductId} onValueChange={(v) => setSelectedProductId(v)} disabled={viewMode}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                  <SelectContent>
                    {selectedSource === "B2B" ? (
                      productsLoading ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : products.length > 0 ? (
                        products.map((p) => <SelectItem key={`b2b-${p.id}`} value={p.id.toString()}>{p.name} ({p.code})</SelectItem>)
                      ) : (
                        <SelectItem value="no-products" disabled>No products</SelectItem>
                      )
                    ) : retailProductsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : retailProducts.length > 0 ? (
                      retailProducts.map((p) => <SelectItem key={`retail-${p.id}`} value={p.id.toString()}>{p.name} ({p.code})</SelectItem>)
                    ) : (
                      <SelectItem value="no-products" disabled>No products</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Quantity</Label>
                <Input
                  className="w-full"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  disabled={viewMode}
                />
              </div>
              <div className="flex items-end"><div className="text-sm text-gray-600">Subtotal: Rp {calculateTotal().toLocaleString("id-ID")}</div></div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={`${it.product.source}-${it.product.id}-${idx}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{it.product.name} ({it.product.code})</span>
                      <span className="text-xs text-gray-500">{it.product.source === "B2B" ? "Master B2B" : "Master Product"}</span>
                      {it.product.source === "Retail" && it.barcode && (
                        <span className="text-xs text-gray-500">Barcode: {it.barcode}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{it.quantity}</TableCell>
                  <TableCell className="text-right">{(it.product.price || 0).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-right">{((it.product.price || 0) * it.quantity).toLocaleString("id-ID")}</TableCell>
                  <TableCell className="text-center">
                    {!viewMode && <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => removeItem(idx)}>Remove</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <DialogFooter>
            <div className="flex-1 text-sm text-gray-700">Total: Rp {calculateTotal().toLocaleString("id-ID")}</div>
            <Button variant="outline" onClick={() => { setIsModalOpen(false); setViewMode(false); setEditingOrderId(null); }} type="button" disabled={isSubmitting}>Close</Button>
            {!viewMode && (
              <Button
                onClick={() => {
                  const hasRetail = items.some((it) => it.product.source === "Retail");
                  if (hasRetail) {
                    openBarcodeModal();
                  } else {
                    submitOrder();
                  }
                }}
                type="button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : (editingOrderId ? "Save" : "Save")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode modal for retail items */}
      <Dialog open={barcodeModalOpen} onOpenChange={setBarcodeModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Input Barcode Produk Retail</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {items.filter((it) => it.product.source === "Retail").length === 0 ? (
              <div className="text-sm text-muted-foreground">Tidak ada produk retail.</div>
            ) : (
              items.map((it, idx) => {
                if (it.product.source !== "Retail") return null;
                const qty = Math.max(1, it.quantity);
                const inputs = barcodeInputs[idx] || Array.from({ length: qty }, () => "");
                return (
                  <div key={`${it.product.id}-${idx}`} className="space-y-1">
                    <div className="text-sm font-medium">
                      {it.product.name} ({it.product.code}) — Qty {qty}
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: qty }).map((_, j) => (
                        <Input
                          key={`${idx}-${j}`}
                          placeholder={`Barcode ${j + 1}`}
                          value={inputs[j] ?? ""}
                          onChange={(e) =>
                            setBarcodeInputs((prev) => {
                              const next = { ...prev };
                              const arr = [...(prev[idx] || inputs)];
                              arr[j] = e.target.value;
                              next[idx] = arr;
                              return next;
                            })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBarcodeModalOpen(false)}>Batal</Button>
            <Button onClick={confirmBarcodesAndSubmit}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
