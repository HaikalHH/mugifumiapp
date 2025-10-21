"use client";
import { useEffect, useState } from "react";
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
  location: string;
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

import { useAuth } from "../providers";

export default function DeliveryPage() {
  const { username } = useAuth();
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
  const [scannedItems, setScannedItems] = useState<Array<{ productId: number; barcode: string; product: any }>>([]);
  const [scanInput, setScanInput] = useState("");
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [regionFilter, setRegionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Lock region filter based on user role
  const getInitialRegion = () => {
    if (username === "Admin" || username === "Manager") {
      return "all"; // Admin and Manager can see all regions
    } else if (username === "Jakarta") {
      return "Jakarta"; // Jakarta user locked to Jakarta
    } else if (username === "Bandung") {
      return "Bandung"; // Bandung user locked to Bandung
    }
    return "all"; // Default fallback
  };

  const [lockedRegion, setLockedRegion] = useState(getInitialRegion());

  const loadDeliveries = async () => {
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
  };

  const loadPendingOrders = async () => {
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
  };

  // Lock region filter based on user role
  useEffect(() => {
    const initialRegion = getInitialRegion();
    setLockedRegion(initialRegion);
    setRegionFilter(initialRegion);
  }, [username]);

  useEffect(() => { loadDeliveries(); }, [page, regionFilter, searchQuery]);
  useEffect(() => { loadPendingOrders(); }, [pendingPage, regionFilter, searchQuery]);

  const openModal = async (order: Order) => {
    setSelectedOrder(order);
    
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
        deliveryDate: deliveryData.deliveryDate ? new Date(deliveryData.deliveryDate) : new Date(),
        ongkirPlan: "",
        ongkirActual: "",
      });
      
      if (deliveryData.items && deliveryData.items.length > 0) {
        const deliveryItems = deliveryData.items.map(item => ({
          productId: item.productId,
          barcode: item.barcode,
          product: item.product
        }));
        setScannedItems(deliveryItems);
      } else {
        setScannedItems([]);
      }
    } else {
      // New delivery
      setForm({
        deliveryDate: new Date(),
        ongkirPlan: "",
        ongkirActual: "",
      });
      setScannedItems([]);
    }
    
    setScanInput("");
    setError("");
    setIsModalOpen(true);
  };

  const addScan = async () => {
    const code = scanInput.trim().toUpperCase();
    if (!code) { 
      setError("Barcode tidak boleh kosong"); 
      return; 
    }
    
    if (!selectedOrder) {
      setError("No order selected");
      return;
    }

    // Check if barcode is already scanned
    if (scannedItems.some((item) => item.barcode === code)) {
      setError("Barcode sudah di-scan");
      return;
    }

    try {
      // Check if barcode exists in inventory and is READY
      // Use search parameter to find by barcode
      const res = await fetch(`/api/inventory/list?search=${encodeURIComponent(code)}&status=READY`);
      const inventoryData = await res.json();
      
      if (!inventoryData || !inventoryData.items || !Array.isArray(inventoryData.items) || inventoryData.items.length === 0) {
        setError("Barcode tidak ditemukan di inventory atau tidak tersedia");
        return;
      }

      // Find exact barcode match
      const inventoryItem = inventoryData.items.find((item: any) => item.barcode === code);
      if (!inventoryItem || typeof inventoryItem !== 'object') {
        setError("Barcode tidak ditemukan di inventory");
        return;
      }

      if (inventoryItem.status !== "READY") {
        setError("Item tidak tersedia (status: " + (inventoryItem.status || "unknown") + ")");
        return;
      }

      // Get product ID from the inventory item
      // We need to find the product ID by matching the product info
      const orderItem = selectedOrder?.items?.find(item => {
        // Match by product name or code since we don't have productId in inventory response
        return item.product.name === inventoryItem.product?.name || 
               item.product.code === inventoryItem.product?.code;
      });

      if (!orderItem) {
        setError("Product ini tidak ada dalam order");
        return;
      }

      // Check if we haven't exceeded the ordered quantity
      const scannedCount = scannedItems.filter(item => item.productId === orderItem.productId).length;
      if (scannedCount >= orderItem.quantity) {
        setError(`Sudah mencapai batas quantity untuk product ini (${orderItem.quantity})`);
        return;
      }

      setError("");
      setScannedItems((prev) => [...prev, { 
        productId: orderItem.productId,
        barcode: code,
        product: orderItem.product
      }]);
      setScanInput("");
    } catch (err) {
      console.error('Barcode validation error:', err);
      setError("Error checking barcode: " + (err as Error).message);
    }
  };

  const removeScan = (index: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
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
    
    if (scannedItems.length === 0) {
      setError("Scan minimal 1 item terlebih dahulu");
      return;
    }

    // Validate Ongkir fields (only for WhatsApp outlet)
    if (selectedOrder?.outlet?.toLowerCase() === "whatsapp") {
      if (!form.ongkirPlan || form.ongkirPlan === "") {
        setError("Ongkir (Plan) harus diisi");
        return;
      }

      if (!form.ongkirActual || form.ongkirActual === "") {
        setError("Ongkir (Actual) harus diisi");
        return;
      }

      const ongkirPlanNum = parseInt(form.ongkirPlan.replace(/[^\d]/g, ""));
      const ongkirActualNum = parseInt(form.ongkirActual.replace(/[^\d]/g, ""));

      if (isNaN(ongkirPlanNum) || ongkirPlanNum <= 0) {
        setError("Ongkir (Plan) harus berupa angka yang valid");
        return;
      }

      if (isNaN(ongkirActualNum) || ongkirActualNum <= 0) {
        setError("Ongkir (Actual) harus berupa angka yang valid");
        return;
      }
    }

    const payload: any = {
      orderId: selectedOrder?.id,
      deliveryDate: form.deliveryDate.toISOString(),
      items: scannedItems.map(item => ({
        productId: item.productId,
        barcode: item.barcode
      })),
    };

    // Only include ongkir fields for WhatsApp outlet
    if (selectedOrder?.outlet?.toLowerCase() === "whatsapp") {
      const ongkirPlanNum = parseInt(form.ongkirPlan.replace(/[^\d]/g, ""));
      const ongkirActualNum = parseInt(form.ongkirActual.replace(/[^\d]/g, ""));
      payload.ongkirPlan = ongkirPlanNum;
      payload.ongkirActual = ongkirActualNum;
    }

    setIsSubmitting(true);
    const res = await fetch("/api/deliveries", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    
    if (res.ok) {
      setIsModalOpen(false);
      loadDeliveries();
      loadPendingOrders(); // Refresh pending orders
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Failed to create delivery");
    }
    setIsSubmitting(false);
  };

  const getOrderSummary = () => {
    if (!selectedOrder) return null;
    
    const orderItemCounts = new Map();
    selectedOrder?.items?.forEach(item => {
      orderItemCounts.set(item.productId, item.quantity);
    });

    const scannedItemCounts = new Map();
    scannedItems.forEach(item => {
      scannedItemCounts.set(item.productId, (scannedItemCounts.get(item.productId) || 0) + 1);
    });

    return { orderItemCounts, scannedItemCounts };
  };

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Delivery</h1>
      
      <div className="flex gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label>Filter by Region</Label>
          {(username === "Admin" || username === "Manager") ? (
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
        <Table>
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
                  <TableCell>{order.outlet}</TableCell>
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
                <TableCell>{delivery.order.outlet}</TableCell>
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
                            items: delivery.items
                          }
                        };
                        openModal(orderWithDelivery);
                      }}
                    >
                      {delivery.status === "pending" ? "Process" : "View"}
                    </Button>
                    {username === "Admin" && delivery.status === "delivered" && (
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
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, "");
                        const formatted = value ? `Rp ${parseInt(value).toLocaleString("id-ID")}` : "";
                        setForm({ ...form, ongkirPlan: formatted });
                      }}
                      className="w-full"
                    />
                  </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Order Items</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-left">Product</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder?.items?.map((item) => {
                        const summary = getOrderSummary();
                        const scannedCount = summary?.scannedItemCounts.get(item.productId) || 0;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{item.product.name}</div>
                                <div className="text-sm text-gray-500">{item.product.code}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={scannedCount >= item.quantity ? "text-green-600" : "text-yellow-600"}>
                                {scannedCount} / {item.quantity}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="font-medium mb-2">
                    {selectedOrder && (selectedOrder._deliveryData || (selectedOrder.deliveries && selectedOrder.deliveries.length > 0)) ? "Scanned Items" : "Scan Items"}
                  </h3>
                  <div className="space-y-2">
                    {(!selectedOrder || (!selectedOrder._deliveryData && (!selectedOrder.deliveries || selectedOrder.deliveries.length === 0))) && (
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Scan barcode" 
                          value={scanInput} 
                          onChange={(e) => setScanInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addScan(); } }}
                        />
                        <Button onClick={addScan} type="button">Add</Button>
                      </div>
                    )}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-left">Barcode</TableHead>
                          <TableHead className="text-left">Product</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scannedItems.map((item, idx) => (
                          <TableRow key={`${item.barcode}-${idx}`}>
                            <TableCell>{item.barcode}</TableCell>
                            <TableCell>{item.product.name}</TableCell>
                            <TableCell className="text-center">
                              {(!selectedOrder || (!selectedOrder._deliveryData && (!selectedOrder.deliveries || selectedOrder.deliveries.length === 0))) && (
                                <Button variant="link" className="text-red-600 p-0 h-auto" onClick={() => removeScan(idx)}>Remove</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} type="button" disabled={isSubmitting}>Close</Button>
            {(!selectedOrder || (!selectedOrder._deliveryData && (!selectedOrder.deliveries || selectedOrder.deliveries.length === 0))) && (
              <Button className="disabled:opacity-50" onClick={submitDelivery} type="button" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit Delivery"}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
