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

type Order = {
  id: number;
  outlet: string;
  customer: string | null;
  orderDate: string;
  deliveryDate?: string | null;
  location: string;
  ongkirPlan?: number | null;
  selfPickup?: boolean | null;
  items: Array<{
    id: number;
    productId: number;
    quantity: number;
    price: number;
    product: {
      id: number;
      code: string;
      name: string;
    };
  }>;
  deliveries?: Array<{
    id: number;
    status: string;
    deliveryDate: string | null;
    ongkirPlan?: number | null;
    ongkirActual?: number | null;
    items: Array<{
      id: number;
      productId: number;
      barcode: string;
      price: number;
      product: {
        id: number;
        code: string;
        name: string;
      };
    }>;
  }>;
  _deliveryData?: {
    id: number;
    status: string;
    deliveryDate: string | null;
    ongkirPlan?: number | null;
    ongkirActual?: number | null;
    items: Array<{
      id: number;
      productId: number;
      barcode: string;
      price: number;
      product: {
        id: number;
        code: string;
        name: string;
      };
    }>;
  };
};

type Delivery = {
  id: number;
  orderId: number;
  deliveryDate: string | null;
  status: string;
  createdAt: string;
  ongkirPlan?: number | null;
  ongkirActual?: number | null;
  order: Order;
  items: Array<{
    id: number;
    productId: number;
    barcode: string;
    price: number;
    product: {
      id: number;
      code: string;
      name: string;
    };
  }>;
};

import { useAuth, hasRole } from "../providers";

export default function DeliveryPage() {
  const { user } = useAuth();

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) {
      return "";
    }
    return `Rp ${value.toLocaleString("id-ID")}`;
  };

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Modal form state
  const [form, setForm] = useState({
    deliveryDate: new Date(),
    ongkirPlan: "",
    ongkirActual: "",
  });
  const [deliveryQuantities, setDeliveryQuantities] = useState<Record<number, number>>({});
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [regionFilter, setRegionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const hasExistingDelivery =
    !!selectedOrder &&
    (selectedOrder._deliveryData || (selectedOrder.deliveries && selectedOrder.deliveries.length > 0));

  // Lock region filter based on user role
  const getInitialRegion = useCallback(() => {
    if (hasRole(user, "Admin") || hasRole(user, "Manager")) {
      return "all"; // Admin and Manager can see all regions
    } else if (user?.role === "Jakarta") {
      return "Jakarta"; // Jakarta user locked to Jakarta
    } else if (user?.role === "Bandung") {
      return "Bandung"; // Bandung user locked to Bandung
    }
    return "all"; // Default fallback
  }, [user?.role]);

  const [lockedRegion, setLockedRegion] = useState(getInitialRegion());

  const loadDeliveries = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (regionFilter !== "all") {
      params.set("location", regionFilter);
    }
    if (searchQuery) {
      params.set("search", searchQuery);
    }
    const res = await fetch(`/api/deliveries?${params.toString()}`);
    const data = await res.json();
    setDeliveries(data.rows || []);
    setTotal(data.total || 0);
  }, [page, regionFilter, searchQuery]);

  const loadPendingOrders = useCallback(async () => {
    try {
      setPendingOrdersLoading(true);
      const params = new URLSearchParams({ page: String(pendingPage), pageSize: "10" });
      if (regionFilter !== "all") {
        params.set("location", regionFilter);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      const res = await fetch(`/api/orders/pending?${params.toString()}`);
      const data = await res.json();
      setPendingOrders(Array.isArray(data.rows) ? data.rows : []);
      setPendingTotal(data.total || 0);
    } catch (error) {
      console.error('Error loading pending orders:', error);
      setPendingOrders([]);
    } finally {
      setPendingOrdersLoading(false);
    }
  }, [pendingPage, regionFilter, searchQuery]);

  // Lock region filter based on user role
  useEffect(() => {
    const initialRegion = getInitialRegion();
    setLockedRegion(initialRegion);
    setRegionFilter(initialRegion);
  }, [getInitialRegion]);

  useEffect(() => { loadDeliveries(); }, [loadDeliveries]);
  useEffect(() => { loadPendingOrders(); }, [loadPendingOrders]);

  const openModal = async (order: Order) => {
    setSelectedOrder(order);
    const plannedDate = order.deliveryDate ? new Date(order.deliveryDate) : new Date();
    
    // If this is a delivered order, load the delivery data
    // Check both order.deliveries (from pending orders) and order._deliveryData (from history)
    let deliveryData = null;
    if (order && order._deliveryData) {
      deliveryData = order._deliveryData;
    } else if (order && order.deliveries && order.deliveries.length > 0) {
      deliveryData = order.deliveries[0];
    }
    
    if (deliveryData) {
    setForm({
      deliveryDate: deliveryData.deliveryDate ? new Date(deliveryData.deliveryDate) : plannedDate,
      ongkirPlan: formatCurrency(deliveryData.ongkirPlan),
      ongkirActual: formatCurrency(deliveryData.ongkirActual),
    });
    
    if (deliveryData.items && deliveryData.items.length > 0) {
      const qtyMap: Record<number, number> = {};
      deliveryData.items.forEach((item) => {
        qtyMap[item.productId] = (qtyMap[item.productId] || 0) + 1;
      });
      setDeliveryQuantities(qtyMap);
    } else {
      const qtyMap: Record<number, number> = {};
      order.items?.forEach((item) => {
        qtyMap[item.productId] = item.quantity;
      });
      setDeliveryQuantities(qtyMap);
    }
    } else {
      // New delivery
      setForm({
        deliveryDate: plannedDate,
        ongkirPlan: order.ongkirPlan ? formatCurrency(order.ongkirPlan) : "",
        ongkirActual: "",
      });
      const qtyMap: Record<number, number> = {};
      (order.items || []).forEach((item) => {
        qtyMap[item.productId] = item.quantity;
      });
      setDeliveryQuantities(qtyMap);
    }

    setError("");
    setIsModalOpen(true);
  };

  const handleQuantityChange = (productId: number, rawValue: string, maxQuantity: number) => {
    const parsed = Math.floor(Number(rawValue));
    const safeValue = Math.min(Math.max(parsed || 0, 0), maxQuantity);
    setDeliveryQuantities((prev) => ({
      ...prev,
      [productId]: safeValue,
    }));
  };

  const handleCancelDelivery = async (deliveryId: number) => {
    if (!confirm("Are you sure you want to cancel this delivery? This will revert the order to pending and change inventory status back to READY.")) {
      return;
    }

    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel delivery");
      }

      // Reload data
      loadDeliveries();
      loadPendingOrders();
      alert("Delivery cancelled successfully");
    } catch (err) {
      console.error("Error cancelling delivery:", err);
      alert("Error cancelling delivery: " + (err as Error).message);
    }
  };

  const submitDelivery = async () => {
    if (!selectedOrder || !selectedOrder.id) {
      setError("No order selected");
      return;
    }

    setError("");
    
    const invalidProduct = selectedOrder.items?.find(
      (item) => (deliveryQuantities[item.productId] ?? 0) > item.quantity,
    );
    if (invalidProduct) {
      setError(`Jumlah ${invalidProduct.product.name} tidak boleh melebihi ${invalidProduct.quantity}`);
      return;
    }

    const payloadItems = Object.entries(deliveryQuantities)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity }))
      .filter((item) => item.quantity > 0);

    if (payloadItems.length === 0) {
      setError("Isi jumlah pengiriman minimal 1 produk");
      return;
    }

    // Validate Ongkir fields (only for WhatsApp outlet) - ongkirPlan read-only from order
    const requiresOngkirActual =
      selectedOrder?.outlet?.toLowerCase() === "whatsapp" && !selectedOrder?.selfPickup;

    if (requiresOngkirActual) {
      if (!form.ongkirActual || form.ongkirActual === "") {
        setError("Ongkir (Actual) harus diisi");
        return;
      }
      const ongkirActualNum = parseInt(form.ongkirActual.replace(/[^\d]/g, ""));
      if (isNaN(ongkirActualNum) || ongkirActualNum <= 0) {
        setError("Ongkir (Actual) harus berupa angka yang valid");
        return;
      }
    }

    const payload: any = {
      orderId: selectedOrder?.id,
      deliveryDate: form.deliveryDate.toISOString(),
      items: payloadItems,
    };

    // Only include ongkir actual for WhatsApp outlet (plan comes from order)
    if (requiresOngkirActual) {
      const ongkirActualNum = parseInt(form.ongkirActual.replace(/[^\d]/g, ""));
      payload.ongkirActual = ongkirActualNum;
    }

    const sendDelivery = async (forceRefund: boolean): Promise<boolean> => {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, forceRefund }),
      });
      const data = await res.json().catch(() => ({} as any));

      if (res.ok) {
        if (Array.isArray(data?.refunds) && data.refunds.length > 0) {
          const message = data.refunds.map((r: any) => `${r.name || r.code || "-"}: ${r.quantity}`).join("\n");
          alert(`Refund/Cancel:\n${message}`);
        }
        setIsModalOpen(false);
        loadDeliveries();
        loadPendingOrders();
        return true;
      }

      if (res.status === 409 && data?.code === "DELIVERY_REFUND_CONFIRM") {
        const shortages: Array<{ name?: string; code?: string; requested: number; available: number }> = data.shortages || [];
        const message =
          shortages.length > 0
            ? shortages
                .map(
                  (s) =>
                    `${s.name || s.code || "-"}\n  Diminta: ${s.requested}\n  Ready: ${s.available}`,
                )
                .join("\n\n")
            : "Beberapa produk tidak memiliki stok cukup.";
        const confirmMessage = `${message}\n\nLanjut proses dan refund otomatis sisa produk?`;
        if (window.confirm(confirmMessage)) {
          return await sendDelivery(true);
        }
        return false;
      }

      setError(data?.error || "Failed to create delivery");
      return false;
    };

    setIsSubmitting(true);
    const success = await sendDelivery(false);
    if (!success) {
      // keep modal open and allow adjustments
    }
    setIsSubmitting(false);
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Delivery</h1>
      
      <div className="flex gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Filter by Region</Label>
          {(hasRole(user, "Admin") || hasRole(user, "Manager")) ? (
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="Bandung">Bandung</SelectItem>
                <SelectItem value="Jakarta">Jakarta</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="w-[200px] border rounded-md p-2 bg-gray-50 text-gray-600">
              {lockedRegion === "all" ? "All Regions" : lockedRegion}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label>Search Customer/ID/HP</Label>
          <Input 
            placeholder="Search..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <Button variant="outline" onClick={() => {
          setRegionFilter("all");
          setSearchQuery("");
          setPage(1);
          setPendingPage(1);
        }}>
          Clear Filters
        </Button>
      </div>

      <div>
        <h2 className="font-medium mb-2">Pending Orders (Ready for Delivery)</h2>
        <div className="overflow-x-auto">
        <Table className="min-w-[720px] md:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Order ID</TableHead>
              <TableHead className="text-left">Outlet</TableHead>
              <TableHead className="text-left">Customer</TableHead>
              <TableHead className="text-left">Order Date</TableHead>
              <TableHead className="text-left">Location</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingOrdersLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Loading pending orders...</TableCell>
              </TableRow>
            ) : pendingOrders.length > 0 ? (
              pendingOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{order.outlet}</span>
                      {order.selfPickup && (
                        <Badge color="gray" className="uppercase tracking-wide">
                          Self Pickup
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{order.customer || "-"}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{order.location}</TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto" 
                      onClick={() => openModal(order)}
                    >
                      Process Delivery
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No pending orders</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-gray-600">
            Showing {((pendingPage - 1) * 10) + 1} to {Math.min(pendingPage * 10, pendingTotal)} of {pendingTotal} orders
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPendingPage(p => Math.max(1, p - 1))}
              disabled={pendingPage === 1}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPendingPage(p => p + 1)}
              disabled={pendingPage * 10 >= pendingTotal}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-medium mb-2">Delivery History</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Order ID</TableHead>
              <TableHead className="text-left">Outlet</TableHead>
              <TableHead className="text-left">Customer</TableHead>
              <TableHead className="text-left">Order Date</TableHead>
              <TableHead className="text-left">Location</TableHead>
              <TableHead className="text-left">Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell>{delivery.orderId}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{delivery.order.outlet}</span>
                    {delivery.order.selfPickup && (
                      <Badge color="gray" className="uppercase tracking-wide">
                        Self Pickup
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{delivery.order.customer || "-"}</TableCell>
                <TableCell>{new Date(delivery.order.orderDate).toLocaleDateString()}</TableCell>
                <TableCell>{delivery.order.location}</TableCell>
                <TableCell>
                  <Badge color={delivery.status === "delivered" ? "green" : "gray"}>
                    {delivery.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex gap-3 justify-center">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto" 
                      onClick={() => {
                        // Pass order with delivery data attached
                        const orderWithDelivery = {
                          ...delivery.order,
                          _deliveryData: {
                            id: delivery.id,
                            status: delivery.status,
                            deliveryDate: delivery.deliveryDate,
                            ongkirPlan: delivery.ongkirPlan,
                            ongkirActual: delivery.ongkirActual,
                            items: delivery.items
                          }
                        };
                        openModal(orderWithDelivery);
                      }}
                    >
                      {delivery.status === "pending" ? "Process" : "View"}
                    </Button>
                    {user?.role === "Admin" && delivery.status === "delivered" && (
                      <Button 
                        variant="link" 
                        className="text-red-600 p-0 h-auto"
                        onClick={() => handleCancelDelivery(delivery.id)}
                      >
                        Cancel
                      </Button>
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

      {/* Delivery Processing Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Process Delivery - Order #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Order Details</h3>
                  <div className="space-y-1 text-sm">
                    <div><strong>Outlet:</strong> {selectedOrder?.outlet}</div>
                    <div><strong>Customer:</strong> {selectedOrder?.customer || "-"}</div>
                    <div><strong>Location:</strong> {selectedOrder?.location}</div>
                    <div><strong>Order Date:</strong> {selectedOrder?.orderDate ? new Date(selectedOrder.orderDate).toLocaleDateString() : "-"}</div>
                    {selectedOrder?.selfPickup && (
                      <div>
                        <Badge color="gray">Self Pickup</Badge>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Delivery Date</h3>
                  <DateTimePicker
                    value={form.deliveryDate}
                    onChange={(date) => setForm({ ...form, deliveryDate: date || new Date() })}
                    placeholder="Select delivery date"
                  />
                </div>
              </div>

              {/* Ongkir fields only for WhatsApp outlet */}
              {selectedOrder?.outlet?.toLowerCase() === "whatsapp" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-2">Ongkir (Plan)</h3>
                    <Input
                      type="text"
                      placeholder="Rp 0"
                      value={form.ongkirPlan}
                      disabled
                      className="w-full"
                    />
                    {selectedOrder?.selfPickup && (
                      <p className="text-xs text-muted-foreground mt-1">Pesanan ini self pickup, ongkir tidak digunakan.</p>
                    )}
                  </div>
                  {!selectedOrder?.selfPickup ? (
                    <div>
                      <h3 className="font-medium mb-2">Ongkir (Actual)</h3>
                      <Input
                        type="text"
                        placeholder="Rp 0"
                        value={form.ongkirActual}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d]/g, "");
                          const formatted = value ? `Rp ${parseInt(value).toLocaleString("id-ID")}` : "";
                          setForm({ ...form, ongkirActual: formatted });
                        }}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {/* Cost Difference Display - only for WhatsApp outlet */}
              {selectedOrder?.outlet?.toLowerCase() === "whatsapp" && form.ongkirPlan && form.ongkirActual && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Cost Analysis</h3>
                  {(() => {
                    const planNum = parseInt(form.ongkirPlan.replace(/[^\d]/g, ""));
                    const actualNum = parseInt(form.ongkirActual.replace(/[^\d]/g, ""));
                    const difference = actualNum - planNum;
                    const differencePercent = planNum > 0 ? (difference / planNum) * 100 : 0;
                    
                    return (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Plan:</span>
                          <span>Rp {planNum.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Actual:</span>
                          <span>Rp {actualNum.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Selisih:</span>
                          <span className={difference > 0 ? "text-red-600" : difference < 0 ? "text-green-600" : "text-gray-600"}>
                            {difference > 0 ? "+" : ""}Rp {difference.toLocaleString("id-ID")} ({differencePercent > 0 ? "+" : ""}{differencePercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <h3 className="font-medium mb-2">Item Pengiriman</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Product</TableHead>
                      <TableHead className="text-center">Ordered</TableHead>
                      <TableHead className="text-center">Deliver Now</TableHead>
                      <TableHead className="text-center">Refund/Cancel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder?.items?.map((item) => {
                      const delivered = deliveryQuantities[item.productId] ?? 0;
                      const refundQty = Math.max(0, item.quantity - delivered);
                      const readOnly =
                        !!selectedOrder &&
                        (selectedOrder._deliveryData ||
                          (selectedOrder.deliveries && selectedOrder.deliveries.length > 0));
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.product.name}</div>
                              <div className="text-sm text-gray-500">{item.product.code}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">{item.quantity}</TableCell>
                          <TableCell className="text-center">
                            {readOnly ? (
                              <span className="text-gray-700">{delivered}</span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                max={item.quantity}
                                value={delivered}
                                onChange={(e) => handleQuantityChange(item.productId, e.target.value, item.quantity)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {refundQty > 0 ? (
                              <span className="text-amber-600 text-sm">Cancel {refundQty}</span>
                            ) : (
                              <span className="text-gray-500 text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="text-xs text-gray-500 mt-2">
                  Jumlah yang tidak dikirim otomatis dianggap refund/cancel dan akan hilang dari order.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} type="button" disabled={isSubmitting}>Close</Button>
            {!hasExistingDelivery && (
              <Button className="disabled:opacity-50" onClick={submitDelivery} type="button" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit Delivery"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
