"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { getStartOfDayJakarta } from "../../lib/timezone";
import { lockedLocation, useAuth } from "../providers";

type MonitoringOrder = {
  id: number;
  outlet: string;
  customer: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  location: string;
  status?: string;
  items: Array<{
    id: number;
    productId: number;
    quantity: number;
    product: {
      id: number;
      code: string;
      name: string;
      price?: number | null;
    };
  }>;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function calculateDaysLeft(dateString?: string | null) {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  const deliveryDay = getStartOfDayJakarta(parsed).getTime();
  const today = getStartOfDayJakarta(new Date()).getTime();
  return Math.round((deliveryDay - today) / MS_PER_DAY);
}

function getUrgencyMeta(daysLeft: number | null) {
  if (daysLeft === null) {
    return { label: "No Date", className: "bg-gray-200 text-gray-700" };
  }
  if (daysLeft < 0) {
    return { label: "Overdue", className: "bg-red-600 text-white" };
  }
  if (daysLeft === 0) {
    return { label: "Due Today", className: "bg-amber-500 text-black" };
  }
  if (daysLeft === 1) {
    return { label: "Due Tomorrow", className: "bg-yellow-200 text-yellow-900" };
  }
  if (daysLeft <= 3) {
    return { label: `${daysLeft} days`, className: "bg-emerald-200 text-emerald-900" };
  }
  return { label: `${daysLeft} days`, className: "bg-gray-100 text-gray-800" };
}

export default function MonitoringPage() {
  const { user } = useAuth();
  const lockedRegion = lockedLocation(user);
  const [location, setLocation] = useState<string>(() => lockedRegion || "all");
  const [orders, setOrders] = useState<MonitoringOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (lockedRegion) {
      setLocation(lockedRegion);
    }
  }, [lockedRegion]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      if (location !== "all") params.set("location", location);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/orders/pending?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch monitoring data");
      }
      const data = await res.json();
      setOrders(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      console.error("Failed to load monitoring data:", err);
      setError(err instanceof Error ? err.message : "Failed to load monitoring data");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [location, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("mf-monitoring-fullscreen", { detail: isFullscreen }));
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mf-monitoring-fullscreen", { detail: false }));
      }
    };
  }, []);

  const stats = useMemo(() => {
    const summary = { overdue: 0, today: 0, upcoming: 0, unscheduled: 0 };
    for (const order of orders) {
      const daysLeft = calculateDaysLeft(order.deliveryDate);
      if (daysLeft === null) {
        summary.unscheduled += 1;
      } else if (daysLeft < 0) {
        summary.overdue += 1;
      } else if (daysLeft === 0) {
        summary.today += 1;
      } else {
        summary.upcoming += 1;
      }
    }
    return summary;
  }, [orders]);

  const applySearch = () => {
    setSearch(searchDraft.trim());
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setLocation(lockedRegion || "all");
  };

  return (
    <main className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monitoring Pengiriman</h1>
          <p className="text-sm text-gray-600">Pantau order yang harus diprioritaskan berdasarkan Delivery Date</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={isFullscreen ? "default" : "outline"}
            onClick={() => setIsFullscreen((prev) => !prev)}
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
          <Button onClick={loadOrders} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded border border-red-200 bg-red-50 p-4">
          <div className="text-sm text-red-600">Overdue</div>
          <div className="text-3xl font-semibold text-red-700">{stats.overdue}</div>
          <p className="text-xs text-red-600">Lewat Delivery Date</p>
        </div>
        <div className="rounded border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-600">Due Today</div>
          <div className="text-3xl font-semibold text-amber-700">{stats.today}</div>
          <p className="text-xs text-amber-600">Harus dikirim hari ini</p>
        </div>
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm text-emerald-600">Upcoming</div>
          <div className="text-3xl font-semibold text-emerald-700">{stats.upcoming}</div>
          <p className="text-xs text-emerald-600">Sudah ada jadwal</p>
        </div>
        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm text-gray-600">Unscheduled</div>
          <div className="text-3xl font-semibold text-gray-700">{stats.unscheduled}</div>
          <p className="text-xs text-gray-600">Belum ada Delivery Date</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Region</Label>
          <Select value={location} onValueChange={setLocation} disabled={Boolean(lockedRegion)}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Region" />
            </SelectTrigger>
            <SelectContent>
              {!lockedRegion && <SelectItem value="all">All Regions</SelectItem>}
              <SelectItem value="Bandung">Bandung</SelectItem>
              <SelectItem value="Jakarta">Jakarta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 flex flex-col gap-1">
          <Label>Search</Label>
          <Input
            value={searchDraft}
            placeholder="Cari customer / outlet / ID order"
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applySearch();
              }
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={applySearch} disabled={loading}>Apply</Button>
          <Button type="button" variant="outline" onClick={clearFilters} disabled={loading}>Clear</Button>
        </div>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded border">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Order</TableHead>
              <TableHead className="text-left">Customer</TableHead>
              <TableHead className="text-left">Location</TableHead>
              <TableHead className="text-left">Order Date</TableHead>
              <TableHead className="text-left">Delivery Date</TableHead>
              <TableHead className="text-left">Items</TableHead>
              <TableHead className="text-left">Days Left</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-gray-500 py-6">
                  {loading ? "Loading orders..." : "Belum ada order menunggu pengiriman"}
                </TableCell>
              </TableRow>
            )}
            {orders.map((order) => {
              const daysLeft = calculateDaysLeft(order.deliveryDate);
              const urgency = getUrgencyMeta(daysLeft);
              const rowHighlight =
                daysLeft === null
                  ? ""
                  : daysLeft < 0
                  ? "bg-red-50"
                  : daysLeft === 0
                  ? "bg-amber-50"
                  : daysLeft <= 3
                  ? "bg-yellow-50"
                  : "";
              return (
                <TableRow key={order.id} className={rowHighlight}>
                  <TableCell>
                    <div className="font-semibold">#{order.id}</div>
                    <div className="text-sm text-gray-600">{order.outlet}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customer || "-"}</div>
                    {order.status && (
                      <Badge color={order.status === "PAID" ? "green" : "red"} className="mt-1 inline-block">
                        {order.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{order.location}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-700 space-y-1">
                      {order.items.map((item) => (
                        <div key={item.id}>
                          {item.product?.name || item.product?.code || `#${item.productId}`} × {item.quantity}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={urgency.className}>{urgency.label}</Badge>
                    {typeof daysLeft === "number" && (
                      <div className="text-xs text-gray-600 mt-1">{daysLeft} day(s)</div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
