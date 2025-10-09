"use client";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

import { useAuth, lockedLocation, hasAccess } from "../providers";

function getInitialLocation(): string {
  if (typeof window !== "undefined") {
    const u = localStorage.getItem("mf_username");
    const locked = lockedLocation((u as any) || null);
    if (locked) return locked;
  }
  return "Bandung";
}

export default function InventoryPage() {
  const { username } = useAuth();
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

  const load = async () => {
    const res = await fetch("/api/inventory/overview");
    const data = await res.json();
    setOverview(data);
  };

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

  useEffect(() => { load(); }, []);

  // lock location for Bandung/Jakarta
  useEffect(() => {
    const locked = lockedLocation(username);
    if (locked) setLocation(locked);
  }, [username]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "Sales") {
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
          <Select value={location} onValueChange={(v) => setLocation(v)} disabled={Boolean(lockedLocation(username))}>
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
          <Button className="w-full" type="submit" disabled={username === "Sales"}>Scan In</Button>
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
              <table className="w-full text-sm border">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-2 text-left font-medium">Menu</th>
                    <th className="p-2 text-right font-medium">Total</th>
                    <th className="p-2 text-right font-medium">Reserved</th>
                    <th className="p-2 text-right font-medium">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(rows).map(([k, stockInfo]) => (
                    <tr key={k} className="border-t hover:bg-gray-50 cursor-pointer" onClick={async () => {
                      const data = await loadInventoryList(k, loc);
                      setDetailModal({ 
                        open: true, 
                        productKey: k, 
                        items: data.items, 
                        search: "", 
                        loc: loc,
                        status: "ALL",
                        page: 1,
                        pagination: data.pagination
                      });
                    }}>
                      <td className="p-2">{k}</td>
                      <td className="p-2 text-right font-medium">{stockInfo.total}</td>
                      <td className="p-2 text-right text-orange-600">{stockInfo.reserved}</td>
                      <td className={`p-2 text-right font-medium ${stockInfo.available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {stockInfo.available}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div>
          <h2 className="font-medium mb-2">All Locations</h2>
          <table className="w-full text-sm border">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-2 text-left font-medium">Menu</th>
                <th className="p-2 text-right font-medium">Total</th>
                <th className="p-2 text-right font-medium">Reserved</th>
                <th className="p-2 text-right font-medium">Available</th>
              </tr>
            </thead>
            <tbody>
              {overview && Object.entries(overview.all).map(([k, stockInfo]) => (
                <tr key={k} className="border-t">
                  <td className="p-2">{k}</td>
                  <td className="p-2 text-right font-medium">{stockInfo.total}</td>
                  <td className="p-2 text-right text-orange-600">{stockInfo.reserved}</td>
                  <td className={`p-2 text-right font-medium ${stockInfo.available < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stockInfo.available}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detailModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md w-full max-w-4xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="font-medium text-lg">Items - {detailModal.productKey}</div>
              <button className="text-gray-600 hover:text-gray-800 text-xl" onClick={() => setDetailModal({ 
                open: false, 
                productKey: null, 
                items: [], 
                search: "", 
                loc: null,
                status: "ALL",
                page: 1,
                pagination: null
              })}>×</button>
            </div>
            
            {/* Search and Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Search Barcode</label>
                <input 
                  className="border rounded p-2" 
                  placeholder="Cari barcode" 
                  value={detailModal.search}
                  onChange={async (e) => {
                    const search = e.target.value;
                    const data = await loadInventoryList(
                      detailModal.productKey || "", 
                      detailModal.loc || "", 
                      search, 
                      detailModal.status, 
                      1
                    );
                    setDetailModal(prev => ({ 
                      ...prev, 
                      search, 
                      items: data.items, 
                      pagination: data.pagination,
                      page: 1
                    }));
                  }} 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Filter Status</label>
                <Select 
                  value={detailModal.status} 
                  onValueChange={async (status) => {
                    const data = await loadInventoryList(
                      detailModal.productKey || "", 
                      detailModal.loc || "", 
                      detailModal.search, 
                      status, 
                      1
                    );
                    setDetailModal(prev => ({ 
                      ...prev, 
                      status, 
                      items: data.items, 
                      pagination: data.pagination,
                      page: 1
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
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left font-medium">Barcode</th>
                    <th className="p-3 text-left font-medium">Location</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-left font-medium">Created</th>
                    <th className="p-3 text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detailModal.items.map((it) => (
                    <tr key={it.barcode} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-mono text-sm">{it.barcode}</td>
                      <td className="p-3">{it.location}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          it.status === 'READY' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {it.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{new Date(it.createdAt).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button 
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed" 
                            disabled={username === "Sales"}
                            onClick={async () => {
                              if (username === "Sales") return; 
                              const toLocation = it.location === "Bandung" ? "Jakarta" : "Bandung";
                              await fetch("/api/inventory/move", { 
                                method: "POST", 
                                headers: { "Content-Type": "application/json" }, 
                                body: JSON.stringify({ barcode: it.barcode, toLocation }) 
                              });
                              const data = await loadInventoryList(
                                detailModal.productKey || "", 
                                toLocation, 
                                detailModal.search, 
                                detailModal.status, 
                                detailModal.page
                              );
                              setDetailModal(prev => ({ 
                                ...prev, 
                                items: data.items, 
                                pagination: data.pagination,
                                loc: toLocation
                              }));
                              load();
                            }}
                          >
                            Move
                          </button>
                          {(username === "Admin") && (
                            <button 
                              className="text-red-600 hover:text-red-800 text-sm font-medium" 
                              onClick={async () => {
                                await fetch(`/api/inventory/item?barcode=${encodeURIComponent(it.barcode)}`, { method: "DELETE" });
                                const data = await loadInventoryList(
                                  detailModal.productKey || "", 
                                  detailModal.loc || "", 
                                  detailModal.search, 
                                  detailModal.status, 
                                  detailModal.page
                                );
                                setDetailModal(prev => ({ 
                                  ...prev, 
                                  items: data.items, 
                                  pagination: data.pagination
                                }));
                                load();
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                        newPage
                      );
                      setDetailModal(prev => ({ 
                        ...prev, 
                        items: data.items, 
                        pagination: data.pagination,
                        page: newPage
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
                        newPage
                      );
                      setDetailModal(prev => ({ 
                        ...prev, 
                        items: data.items, 
                        pagination: data.pagination,
                        page: newPage
                      }));
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}


