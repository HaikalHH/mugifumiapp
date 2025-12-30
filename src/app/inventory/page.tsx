"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useAuth, lockedLocation } from "../providers";

type StockInfo = {
  total: number;
  reserved: number;
  available: number;
};

type InventoryOverview = {
  byLocation: Record<string, Record<string, StockInfo>>;
  all: Record<string, StockInfo>;
};

type Product = {
  id: number;
  code: string;
  name: string;
};

const LOCATIONS = ["Bandung", "Jakarta"] as const;

function parseProductCode(key: string): string | null {
  const match = /\(([^)]+)\)$/.exec(key);
  return match ? match[1].toUpperCase() : null;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of products) {
      map.set(product.code.toUpperCase(), product);
    }
    return map;
  }, [products]);

  const refreshOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch("/api/inventory/overview");
      const data = await res.json();
      setOverview(data);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    refreshOverview();
    loadProducts();
  }, [refreshOverview, loadProducts]);

  const locked = lockedLocation(user);
  const manageableLocations = locked ? [locked] : LOCATIONS;

  const [editModal, setEditModal] = useState<{
    open: boolean;
    productKey: string;
    product: Product | null;
    values: Record<(typeof LOCATIONS)[number], number>;
    saving: boolean;
    error: string;
  }>({
    open: false,
    productKey: "",
    product: null,
    values: { Bandung: 0, Jakarta: 0 },
    saving: false,
    error: "",
  });

  const openEditModal = (productKey: string) => {
    const code = parseProductCode(productKey);
    if (!code) return;
    const product = productMap.get(code);
    if (!product) return;

    const values: Record<(typeof LOCATIONS)[number], number> = {
      Bandung: overview?.byLocation?.Bandung?.[productKey]?.total || 0,
      Jakarta: overview?.byLocation?.Jakarta?.[productKey]?.total || 0,
    };

    setEditModal({
      open: true,
      productKey,
      product,
      values,
      saving: false,
      error: "",
    });
  };

  const handleValueChange = (location: (typeof LOCATIONS)[number], value: string) => {
    const num = Math.max(0, Math.floor(Number(value) || 0));
    setEditModal((prev) => ({
      ...prev,
      values: { ...prev.values, [location]: num },
    }));
  };

  const saveStock = async () => {
    if (!editModal.product) return;
    setEditModal((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      const payloads = manageableLocations
        .filter((loc) => {
          const current = overview?.byLocation?.[loc]?.[editModal.productKey]?.total || 0;
          return current !== editModal.values[loc];
        })
        .map((loc) =>
          fetch("/api/inventory/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: editModal.product!.id,
              location: loc,
              quantity: editModal.values[loc],
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const error = await res.json().catch(() => ({}));
              throw new Error(error?.error || "Gagal menyimpan stok");
            }
          }),
        );

      await Promise.all(payloads);
      await refreshOverview();
      setEditModal({
        open: false,
        productKey: "",
        product: null,
        values: { Bandung: 0, Jakarta: 0 },
        saving: false,
        error: "",
      });
    } catch (error) {
      setEditModal((prev) => ({
        ...prev,
        saving: false,
        error: error instanceof Error ? error.message : "Gagal menyimpan stok",
      }));
    }
  };

  const closeModal = () => {
    if (editModal.saving) return;
    setEditModal({
      open: false,
      productKey: "",
      product: null,
      values: { Bandung: 0, Jakarta: 0 },
      saving: false,
      error: "",
    });
  };

  const formatNumber = (value: number) => value.toLocaleString("id-ID");

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-gray-600">
            Kelola stok per SKU. Reserved dihitung otomatis dari order yang belum terkirim. Stok akan berkurang ketika
            delivery selesai seperti sebelumnya.
          </p>
          {locked && (
            <p className="text-sm text-amber-600 mt-1">Anda hanya bisa mengubah stok lokasi {locked}.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshOverview} disabled={loadingOverview}>
            {loadingOverview ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(overview?.byLocation || {}).map(([loc, rows]) => (
          <div key={loc}>
            <h2 className="font-medium mb-2">{loc}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Menu</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(rows).map(([key, stock]) => (
                  <TableRow key={`${loc}-${key}`}>
                    <TableCell>{key}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(stock.total)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatNumber(stock.reserved)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        stock.available < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {formatNumber(stock.available)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium">All Locations</h2>
          {(loadingOverview || loadingProducts) && <span className="text-xs text-gray-500">Memuat data...</span>}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Menu</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-center w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overview &&
              Object.entries(overview.all).map(([key, stock]) => {
                const code = parseProductCode(key);
                const product = code ? productMap.get(code) : null;
                const disabled = !product;
                return (
                  <TableRow key={key}>
                    <TableCell>{key}</TableCell>
                    <TableCell className="text-right font-medium">{formatNumber(stock.total)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatNumber(stock.reserved)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        stock.available < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {formatNumber(stock.available)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="link"
                        className="p-0 h-auto disabled:opacity-50"
                        disabled={disabled}
                        onClick={() => openEditModal(key)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editModal.open} onOpenChange={(open) => (!open ? closeModal() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit Stok {editModal.product?.name} ({editModal.product?.code})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {LOCATIONS.map((loc) => {
              const disabled = Boolean(locked && locked !== loc);
              return (
                <div key={loc} className="flex flex-col gap-1">
                  <Label>{loc}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editModal.values[loc]}
                    disabled={disabled || editModal.saving}
                    onChange={(e) => handleValueChange(loc, e.target.value)}
                  />
                </div>
              );
            })}
            {editModal.error && (
              <div className="text-sm text-red-600 border border-red-200 rounded-md px-3 py-2 bg-red-50">
                {editModal.error}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeModal} disabled={editModal.saving}>
              Cancel
            </Button>
            <Button onClick={saveStock} disabled={editModal.saving || manageableLocations.length === 0}>
              {editModal.saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
