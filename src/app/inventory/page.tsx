"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";

import { useAuth, lockedLocation, hasAccess } from "../providers";

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

export default function InventoryPage() {
  const { user } = useAuth();
  const [barcode, setBarcode] = useState("");
  const [location, setLocation] = useState<string>(() => getInitialLocation());
  
  interface StockInfo {
    total: number;
    reserved: number;
    available: number;
  }
  
  const [overview, setOverview] = useState<{ byLocation: Record<string, Record<string, StockInfo>>; all: Record<string, StockInfo> } | null>(null);
  const [detailModal, setDetailModal] = useState<{ 
    open: boolean; 
    productKey: string | null; 
    items: any[]; 
    search: string; 
    loc: string | null;
    status: string;
    page: number;
    pagination: any;
  }>({ 
    open: false, 
    productKey: null, 
    items: [], 
    search: "", 
    loc: null,
    status: "ALL",
    page: 1,
    pagination: null
  });
  const [scanError, setScanError] = useState<string>("");

  const load = useCallback(async () => {
    const res = await fetch("/api/inventory/overview");
    const data = await res.json();
    setOverview(data);
  }, []);

  const loadInventoryList = async (productKey: string, loc: string, search: string = "", status: string = "ALL", page: number = 1) => {
    const match = /\(([^)]+)\)$/.exec(productKey);
    const productCode = match ? match[1] : undefined;
    const params = new URLSearchParams({ 
      location: loc, 
      productCode: productCode || "",
      page: page.toString(),
      limit: "10"
    });
    if (search) params.set("search", search);
    if (status && status !== "ALL") params.set("status", status);
    
    const res = await fetch(`/api/inventory/list?${params.toString()}`);
    const data = await res.json();
    return data;
  };

  useEffect(() => { load(); }, [load]);

  // lock location for Bandung/Jakarta
  useEffect(() => {
    const locked = lockedLocation(user);
    if (locked) setLocation(locked);
  }, [user]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role === "Sales") {
      setScanError("❌ Sales hanya bisa view inventory");
      return;
    }
    if (!barcode.trim()) return;
    setScanError("");
    
    const res = await fetch("/api/inventory/in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barcode, location }) });
    
    if (res.ok) {
      const data = await res.json();
      setBarcode("");
      load();
      
      // Show success message for auto-move
      if (data.action === 'moved') {
        setScanError(`✅ ${data.message}`);
        // Clear success message after 3 seconds
        setTimeout(() => setScanError(""), 3000);
      }
    } else {
      const error = await res.json();
      if (res.status === 409) {
        setScanError(`❌ ${error.error || "Barcode sudah pernah di-scan sebelumnya"}`);
      } else {
        setScanError(`❌ ${error.error || "Gagal menambahkan inventory"}`);
      }
    }
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Inventory</h1>
      <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label>Barcode</Label>
          <Input placeholder="Scan barcode" value={barcode} onChange={(e) => { setBarcode(e.target.value); setScanError(""); }} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Location</Label>
          <Select value={location} onValueChange={(v) => setLocation(v)} disabled={Boolean(lockedLocation(user))}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih lokasi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bandung">Bandung</SelectItem>
              <SelectItem value="Jakarta">Jakarta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex">
          <Button className="w-full" type="submit" disabled={user?.role === "Sales"}>Scan In</Button>
        </div>
      </form>
      
      {scanError && (
        <div className={`p-3 border rounded-md text-sm ${
          scanError.startsWith('✅') 
            ? 'bg-green-50 border-green-200 text-green-700' 
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {scanError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-medium mb-2">By Location</h2>
          {overview && Object.entries(overview.byLocation).map(([loc, rows]) => (
            <div key={loc} className="mb-4">
              <div className="font-medium mb-2">{loc}</div>
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
                  {Object.entries(rows).map(([k, stockInfo]) => (
                    <TableRow
                      key={k}
                      className="cursor-pointer"
                      onClick={async () => {
                        const data = await loadInventoryList(k, loc);
                        setDetailModal({
                          open: true,
                          productKey: k,
                          items: data.items,
                          search: "",
                          loc: loc,
                          status: "ALL",
                          page: 1,
                          pagination: data.pagination,
                        });
                      }}
                    >
                      <TableCell>{k}</TableCell>
                      <TableCell className="text-right font-medium">{stockInfo.total}</TableCell>
                      <TableCell className="text-right text-orange-600">{stockInfo.reserved}</TableCell>
                      <TableCell className={`text-right font-medium ${stockInfo.available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stockInfo.available}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
        <div>
          <h2 className="font-medium mb-2">All Locations</h2>
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
              {overview && Object.entries(overview.all).map(([k, stockInfo]) => (
                <TableRow key={k}>
                  <TableCell>{k}</TableCell>
                  <TableCell className="text-right font-medium">{stockInfo.total}</TableCell>
                  <TableCell className="text-right text-orange-600">{stockInfo.reserved}</TableCell>
                  <TableCell className={`text-right font-medium ${stockInfo.available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stockInfo.available}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog
        open={detailModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setDetailModal({
              open: false,
              productKey: null,
              items: [],
              search: "",
              loc: null,
              status: "ALL",
              page: 1,
              pagination: null,
            });
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Items - {detailModal.productKey}</DialogTitle>
          </DialogHeader>
          {/* Search and Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Search Barcode</Label>
              <Input
                placeholder="Cari barcode"
                value={detailModal.search}
                onChange={async (e) => {
                  const search = e.target.value;
                  const data = await loadInventoryList(
                    detailModal.productKey || "",
                    detailModal.loc || "",
                    search,
                    detailModal.status,
                    1,
                  );
                  setDetailModal((prev) => ({
                    ...prev,
                    search,
                    items: data.items,
                    pagination: data.pagination,
                    page: 1,
                  }));
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Filter Status</Label>
              <Select
                value={detailModal.status}
                onValueChange={async (status) => {
                  const data = await loadInventoryList(
                    detailModal.productKey || "",
                    detailModal.loc || "",
                    detailModal.search,
                    status,
                    1,
                  );
                  setDetailModal((prev) => ({
                    ...prev,
                    status,
                    items: data.items,
                    pagination: data.pagination,
                    page: 1,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="READY">Ready</SelectItem>
                  <SelectItem value="SOLD">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <div className="text-sm text-gray-600">
                Total: {detailModal.pagination?.totalCount || 0} items
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Barcode</TableHead>
                  <TableHead className="text-left">Location</TableHead>
                  <TableHead className="text-left">Status</TableHead>
                  <TableHead className="text-left">Created</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailModal.items.map((it) => (
                  <TableRow key={it.barcode}>
                    <TableCell className="font-mono text-sm">{it.barcode}</TableCell>
                    <TableCell>{it.location}</TableCell>
                    <TableCell>
                      <Badge color={it.status === "READY" ? "green" : "red"}>{it.status}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-600">{new Date(it.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="link"
                          className="p-0 h-auto disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={user?.role === "Sales"}
                          onClick={async () => {
                            if (user?.role === "Sales") return;
                            const toLocation = it.location === "Bandung" ? "Jakarta" : "Bandung";
                            await fetch("/api/inventory/move", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ barcode: it.barcode, toLocation }),
                            });
                            const data = await loadInventoryList(
                              detailModal.productKey || "",
                              toLocation,
                              detailModal.search,
                              detailModal.status,
                              detailModal.page,
                            );
                            setDetailModal((prev) => ({
                              ...prev,
                              items: data.items,
                              pagination: data.pagination,
                              loc: toLocation,
                            }));
                            load();
                          }}
                        >
                          Move
                        </Button>
                        {user?.role === "Admin" && (
                          <Button
                            variant="link"
                            className="text-red-600 p-0 h-auto"
                            onClick={async () => {
                              await fetch(`/api/inventory/item?barcode=${encodeURIComponent(it.barcode)}`, { method: "DELETE" });
                              const data = await loadInventoryList(
                                detailModal.productKey || "",
                                detailModal.loc || "",
                                detailModal.search,
                                detailModal.status,
                                detailModal.page,
                              );
                              setDetailModal((prev) => ({
                                ...prev,
                                items: data.items,
                                pagination: data.pagination,
                              }));
                              load();
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {detailModal.pagination && detailModal.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((detailModal.page - 1) * 10) + 1} to {Math.min(detailModal.page * 10, detailModal.pagination.totalCount)} of {detailModal.pagination.totalCount} results
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!detailModal.pagination.hasPrev}
                  onClick={async () => {
                    const newPage = detailModal.page - 1;
                    const data = await loadInventoryList(
                      detailModal.productKey || "",
                      detailModal.loc || "",
                      detailModal.search,
                      detailModal.status,
                      newPage,
                    );
                    setDetailModal((prev) => ({
                      ...prev,
                      items: data.items,
                      pagination: data.pagination,
                      page: newPage,
                    }));
                  }}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-sm">Page</span>
                  <span className="text-sm font-medium">{detailModal.page}</span>
                  <span className="text-sm">of</span>
                  <span className="text-sm font-medium">{detailModal.pagination.totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!detailModal.pagination.hasNext}
                  onClick={async () => {
                    const newPage = detailModal.page + 1;
                    const data = await loadInventoryList(
                      detailModal.productKey || "",
                      detailModal.loc || "",
                      detailModal.search,
                      detailModal.status,
                      newPage,
                    );
                    setDetailModal((prev) => ({
                      ...prev,
                      items: data.items,
                      pagination: data.pagination,
                      page: newPage,
                    }));
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
