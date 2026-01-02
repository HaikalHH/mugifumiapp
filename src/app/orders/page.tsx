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
import { toUTCForJakarta, getStartOfDayJakarta, getEndOfDayJakarta } from "../../lib/timezone";
import { usePathname } from "next/navigation";

type Order = { 
  id: number; 
  outlet: string; 
  location: string; 
  orderDate: string; 
  deliveryDate?: string | null;
  customer?: string | null; 
  status: string;
  totalAmount?: number | null;
  discount?: number | null;
  actPayout?: number | null;
  ongkirPlan?: number | null;
  paymentLink?: string | null;
  midtransOrderId?: string | null;
  midtransTransactionId?: string | null;
  midtransFee?: number | null;
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
      price?: number;
    };
  }>;
  deliveries?: Array<{
    id: number;
    status: string;
  }>;
};

type Product = {
  id: number;
  code: string;
  name: string;
  price: number;
};

import { useAuth, lockedLocation, hasRole } from "../providers";

type OrderStatus = "PAID" | "NOT PAID";
const ORDER_STATUS_OPTIONS: OrderStatus[] = ["PAID", "NOT PAID"];
const DEFAULT_ORDER_STATUS: OrderStatus = "PAID";

function outletHasActPayout(outlet: string): boolean {
  return ["Tokopedia", "Shopee", "Cafe", "Wholesale", "Complain"].includes(outlet);
}

function normalizeOrderStatus(status?: string | null): OrderStatus {
  if (!status) return "PAID";
  const normalized = status.trim().toUpperCase().replace(/\s+/g, " ");
  return normalized === "NOT PAID" || normalized === "NOT_PAID" ? "NOT PAID" : "PAID";
}

function getStatusBadgeColor(status: OrderStatus) {
  return status === "PAID" ? "green" : "red";
}

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

export default function OrdersPage() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isWhatsAppPage = pathname === "/orders-whatsapp";
  const [orders, setOrders] = useState<Order[]>([]);
  const [outlet, setOutlet] = useState(isWhatsAppPage ? "WhatsApp" : "Tokopedia");
  const [location, setLocation] = useState<string>(() => getInitialLocation());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [boxPrompt, setBoxPrompt] = useState<null | { boxProduct: Product; boxCode: string; boxPrice: number; targetCode: string }>(null);

  // Modal form state
  const [form, setForm] = useState<{
    customer: string;
    status: OrderStatus;
    orderDate: Date | null;
    deliveryDate: Date | null;
    discount: string;
    estPayout: string;
    actPayout: string;
    ongkirPlan: string;
    selfPickup: boolean;
  }>({
    customer: "",
    status: DEFAULT_ORDER_STATUS,
    orderDate: null,
    deliveryDate: null,
    discount: "",
    estPayout: "",
    actPayout: "",
    ongkirPlan: "",
    selfPickup: false,
  });
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingOutlet, setEditingOutlet] = useState<string>("");
  const [editingLocation, setEditingLocation] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Array<{ productId: number; quantity: number; product: Product }>>([]);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualProcessingId, setManualProcessingId] = useState<number | null>(null);

  // Product selection state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [inventoryOverview, setInventoryOverview] = useState<null | { byLocation: Record<string, Record<string, { total: number; reserved: number; available: number }>> }>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [search, setSearch] = useState("");

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (isWhatsAppPage) {
      params.set("outlet", "WhatsApp");
    } else {
      params.set("excludeOutlet", "WhatsApp");
    }
    if (from) {
      const fromJakarta = getStartOfDayJakarta(from);
      params.set("from", fromJakarta.toISOString());
    }
    if (to) {
      const toJakarta = getEndOfDayJakarta(to);
      params.set("to", toJakarta.toISOString());
    }
    if (search.trim()) {
      params.set("search", search.trim());
    }
    const res = await fetch(`/api/orders?${params.toString()}`);
    const data = await res.json();
    setOrders(data.rows || []);
    setTotal(data.total || 0);
  }, [page, from, to, search, isWhatsAppPage]);

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadProducts(); }, []);

  // lock location for Bandung/Jakarta
  useEffect(() => {
    const locked = lockedLocation(user);
    if (locked) setLocation(locked);
  }, [user]);

  const openModal = () => {
    setEditingOrderId(null); // Reset editing state
    setEditingOutlet(""); // Reset editing outlet
    setEditingLocation(""); // Reset editing location
    setForm({
      customer: "",
      status: DEFAULT_ORDER_STATUS,
      orderDate: null,
      deliveryDate: null,
      discount: "",
      estPayout: "",
      actPayout: "",
      ongkirPlan: "",
      selfPickup: false,
    });
    setSelectedItems([]);
    setIsModalOpen(true);
  };

  const openProductModal = async () => {
    setSelectedProduct(null);
    setQuantity(1);
    try {
      if (!inventoryOverview) {
        const res = await fetch('/api/inventory/overview');
        if (res.ok) {
          const data = await res.json();
          setInventoryOverview({ byLocation: data.byLocation || {} });
        }
      }
    } catch (e) {
      // ignore fetch errors, fallback to no warning
    }
    setIsProductModalOpen(true);
  };

  const addProduct = async () => {
    if (!selectedProduct) {
      setError("Please select a product");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }
    // Check inventory availability for current location
    try {
      const currentLoc = editingOrderId ? editingLocation : location;
      let overview = inventoryOverview;
      if (!overview) {
        const res = await fetch('/api/inventory/overview');
        if (res.ok) {
          const data = await res.json();
          overview = { byLocation: data.byLocation || {} };
          setInventoryOverview(overview);
        }
      }
      const key = `${selectedProduct.name} (${selectedProduct.code})`;
      const locData = overview?.byLocation?.[currentLoc]?.[key];
      const available = locData ? Number(locData.available) : 0;
      if (available - quantity < 0) {
        const proceed = window.confirm('Item ini sedang tidak tersedia atau stok kurang. Apakah Anda yakin ingin menambahkan?');
        if (!proceed) {
          return;
        }
      }
    } catch (e) {
      // if check fails, continue silently
    }

    setError("");
    const nextItems = [...selectedItems, { 
      productId: selectedProduct.id, 
      quantity, 
      product: selectedProduct 
    }];

    // Auto BOX selection for WA/Tokopedia/Shopee with hardcoded codes
    const outletForBox = editingOrderId ? editingOutlet : outlet;
    const code = (selectedProduct.code || "").toUpperCase();
    const needsBox = outletForBox === "WhatsApp" || outletForBox === "Tokopedia" || outletForBox === "Shopee";
    const promptBoxCodes = new Set([
      "HOK-L","HOK-R","WHO-L","WHO-R","MAT-L","MAT-R","SAK-L","SAK-R","YAM-L","YAM-R",
      "COK-L","COK-R"
    ]);
    const autoBoxCodes = new Set([
      "COK-L","COK-R","ABO","MAC"
    ]);

    const isPrompt = promptBoxCodes.has(code);
    const isAuto = autoBoxCodes.has(code);

    if (needsBox && (isPrompt || isAuto)) {
      let boxType: "L" | "R" = "L";
      if (code.endsWith("-R")) boxType = "R";
      if (code === "COK-R") boxType = "R";
      // ABO and MAC default to L
      const boxCode = boxType === "L" ? "BOX-L" : "BOX-R";
      const boxPrice = boxType === "L" ? 4000 : 3000;
      const boxProduct = products.find(p => p.code.toUpperCase() === boxCode);

      const addBox = isAuto;
      if (isPrompt && !isAuto) {
        if (!boxProduct) {
          setError(`Produk BOX (${boxCode}) tidak ditemukan. Tambahkan di Products dengan harga ${boxPrice}.`);
          setIsProductModalOpen(false);
          setSelectedProduct(null);
          setQuantity(1);
          return;
        }
        // Open nicer prompt instead of alert/confirm
        setBoxPrompt({ boxProduct, boxCode, boxPrice, targetCode: selectedProduct.code });
      }

      if (addBox) {
        if (!boxProduct) {
          setError(`Produk BOX (${boxCode}) tidak ditemukan. Tambahkan di Products dengan harga ${boxPrice}.`);
          setIsProductModalOpen(false);
          setSelectedProduct(null);
          setQuantity(1);
          return;
        }
        nextItems.push({
          productId: boxProduct.id,
          quantity: 1,
          product: boxProduct
        });
      }
    }

    setSelectedItems(nextItems);
    setIsProductModalOpen(false);
  };

  const addBoxFromPrompt = () => {
    if (!boxPrompt) return;
    const { boxProduct } = boxPrompt;
    setSelectedItems(prev => [...prev, {
      productId: boxProduct.id,
      quantity: 1,
      product: boxProduct
    }]);
    setBoxPrompt(null);
  };

  const removeItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleViewOrder = (orderId: number) => {
    // Find the order and show details
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const statusLabel = normalizeOrderStatus(order.status);
      alert(`View Order #${orderId}\nOutlet: ${order.outlet}\nCustomer: ${order.customer || '-'}\nStatus: ${statusLabel}\nDelivery Date: ${
        order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "-"
      }\nTotal: Rp ${order.totalAmount?.toLocaleString('id-ID') || '0'}`);
    }
  };

  const handleEditOrder = async (orderId: number) => {
    // Find the order and populate form for editing
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setEditingOrderId(orderId); // Set editing state
      setEditingOutlet(order.outlet); // Set editing outlet
      setEditingLocation(order.location); // Set editing location
    setForm({
      customer: order.customer || "",
      status: normalizeOrderStatus(order.status),
      orderDate: new Date(order.orderDate),
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : null,
      discount: order.discount?.toString() || "",
      estPayout: "",
      actPayout: order.actPayout?.toString() || "",
      ongkirPlan: order.ongkirPlan ? order.ongkirPlan.toString() : "",
      selfPickup: Boolean(order.selfPickup),
    });
      
      // Ensure we have complete product data for each item
      const itemsWithProducts = await Promise.all(
        order.items.map(async (item) => {
          // If product data is incomplete, fetch it
          if (!item.product || !item.product.price) {
            try {
              const res = await fetch(`/api/products/${item.productId}`);
              const productData = await res.json();
              return {
                productId: item.productId,
                quantity: item.quantity,
                product: productData
              };
            } catch (error) {
              console.error('Error fetching product:', error);
              // Fallback to existing data
              return {
                productId: item.productId,
                quantity: item.quantity,
                product: item.product || { id: item.productId, name: 'Unknown Product', price: 0, code: 'N/A' }
              };
            }
          }
          return {
            productId: item.productId,
            quantity: item.quantity,
            product: item.product
          };
        })
      );
      
      setSelectedItems(itemsWithProducts);
      setIsModalOpen(true);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (order && order.deliveries && order.deliveries.length > 0) {
      alert("Cannot delete order that has been delivered");
      return;
    }

    if (!confirm("Are you sure you want to delete this order?")) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete order");
      }

      // Reload orders
      loadOrders();
      alert("Order deleted successfully");
    } catch (err) {
      console.error("Error deleting order:", err);
      alert("Error deleting order: " + (err as Error).message);
    }
  };

  const handleManualPaid = async (orderId: number) => {
    if (!confirm("Tandai order ini sebagai sudah dibayar manual?")) {
      return;
    }
    setManualProcessingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual-paid" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.error) || "Gagal update status");
      }
      loadOrders();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setManualProcessingId(null);
    }
  };

  const handleModalOutletChange = (value: string) => {
    if (isWhatsAppPage) {
      setOutlet("WhatsApp");
      setEditingOutlet("WhatsApp");
      setForm((prev) => ({
        ...prev,
        status: "NOT PAID",
        selfPickup: prev.selfPickup,
      }));
      return;
    }
    if (editingOrderId) {
      setEditingOutlet(value);
      setForm((prev) => ({
        ...prev,
        status: value === "WhatsApp" ? "NOT PAID" : DEFAULT_ORDER_STATUS,
        selfPickup: value === "WhatsApp" ? prev.selfPickup : false,
      }));
      return;
    }
    setOutlet(value);
    setForm((prev) => ({
      ...prev,
      status: value === "WhatsApp" ? "NOT PAID" : DEFAULT_ORDER_STATUS,
      selfPickup: value === "WhatsApp" ? prev.selfPickup : false,
    }));
  };

  const submitOrder = async () => {
    setError("");
    
    if (!form.customer.trim()) {
      setError("Customer wajib diisi");
      return;
    }
    if (!form.orderDate) {
      setError("Order Date wajib diisi");
      return;
    }
    if (!form.deliveryDate) {
      setError("Delivery Date wajib diisi");
      return;
    }
    if (form.orderDate && form.deliveryDate && form.deliveryDate.getTime() < form.orderDate.getTime()) {
      setError("Delivery Date tidak boleh sebelum Order Date");
      return;
    }
    if (isWhatsAppModal && !form.selfPickup) {
      const ongkirNum = Number(form.ongkirPlan);
      if (!ongkirNum || Number.isNaN(ongkirNum) || ongkirNum <= 0) {
        setError("Ongkir Plan wajib diisi untuk WhatsApp");
        return;
      }
    }
    if (selectedItems.length === 0) {
      setError("Tambah minimal 1 item terlebih dahulu");
      return;
    }

    // Convert order date to UTC for Jakarta timezone
    const orderDateUTC = toUTCForJakarta(form.orderDate as Date);
    const deliveryDateUTC = toUTCForJakarta(form.deliveryDate as Date);

    const currentOutlet = editingOrderId ? editingOutlet : outlet;
    const currentLocation = editingOrderId ? editingLocation : location;

    type OrderUpsertPayload = {
      outlet: string;
      location: string;
      customer: string;
      status: OrderStatus;
      orderDate: string; // ISO in UTC
      deliveryDate: string;
      discount: number | null;
      actPayout: number | null;
      ongkirPlan: number | null;
      items: Array<{ productId: number; quantity: number }>;
      selfPickup: boolean;
    };

    const payload: OrderUpsertPayload = {
      outlet: currentOutlet,
      location: currentLocation,
      customer: form.customer,
      status: form.status,
      orderDate: orderDateUTC.toISOString(),
      deliveryDate: deliveryDateUTC.toISOString(),
      discount: form.discount ? Number(form.discount) : null,
      actPayout: outletHasActPayout(currentOutlet) && form.actPayout ? Number(form.actPayout) : null,
      ongkirPlan: isWhatsAppModal && !form.selfPickup ? Number(form.ongkirPlan) : null,
      items: selectedItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      selfPickup: isWhatsAppModal ? form.selfPickup : false,
    };

    setIsSubmitting(true);
    const url = editingOrderId ? `/api/orders/${editingOrderId}` : "/api/orders";
    const method = editingOrderId ? "PUT" : "POST";
    
    const res = await fetch(url, { 
      method, 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    
    const data = await res.json().catch(() => null);

    if (res.ok) {
      // Send WhatsApp notification only on create (not on edit)
      if (!editingOrderId) {
        try {
          const orderOutlet = currentOutlet;
          const orderLocation = currentLocation;
          const orderCustomer = form.customer || "-";
          const orderTotal = calculateTotal();
          const orderItems = selectedItems.map((it) => {
            const name = it.product?.name || `#${it.productId}`;
            const price = it.product?.price || 0;
            const subtotal = price * it.quantity;
            return {
              name,
              quantity: it.quantity,
              price,
              subtotal
            };
          });

          // Send notification via Ultramsg API
          const notificationResponse = await fetch("/api/whatsapp/send-order-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              outlet: orderOutlet,
              location: orderLocation,
              customer: orderCustomer,
              total: orderTotal,
              items: orderItems
            })
          });

          if (notificationResponse.ok) {
            const notificationData = await notificationResponse.json();
            console.log("Order notification sent:", notificationData.message);
          } else {
            console.error("Failed to send order notification");
          }
        } catch (error) {
          console.error("Error sending order notification:", error);
        }
      }
      setIsModalOpen(false);
      loadOrders();
    } else {
      setError((data && data.error) || "Failed to create order");
    }
    setIsSubmitting(false);
  };

  const calculateTotal = () => {
    const subtotal = selectedItems.reduce((acc, item) => {
      const price = item.product?.price || 0;
      return acc + (price * item.quantity);
    }, 0);
    const discount = form.discount ? Number(form.discount) : 0;
    const afterDiscount = discount > 0 ? Math.round(subtotal * (1 - discount / 100)) : subtotal;
    const requireOngkir = isWhatsAppModal && !form.selfPickup;
    const ongkirValue = requireOngkir ? Number(form.ongkirPlan || 0) : 0;
    return afterDiscount + (Number.isFinite(ongkirValue) ? ongkirValue : 0);
  };

  const editingOrder = editingOrderId ? orders.find(o => o.id === editingOrderId) : null;
  const isEditingDelivered = Boolean(editingOrder?.deliveries && editingOrder.deliveries.length > 0);

  const currentModalOutlet = editingOrderId ? editingOutlet : outlet;
  const isWhatsAppModal = currentModalOutlet === "WhatsApp";

  // Do not lock Orders page for composite roles; only block if user lacks allowed roles
  const allowed = isWhatsAppPage
    ? (user && (hasRole(user, "Manager") || hasRole(user, "BDGSales") || hasRole(user, "Admin")))
    : (user && (hasRole(user, "Sales") || hasRole(user, "Admin") || hasRole(user, "Manager")));

  if (!allowed) {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">{isWhatsAppPage ? "Orders - WhatsApp" : "Orders"}</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        {!isWhatsAppPage && (
          <div className="flex flex-col gap-1">
            <Label>Outlet</Label>
            <Select value={outlet} onValueChange={handleModalOutletChange}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Outlet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Tokopedia">Tokopedia</SelectItem>
                <SelectItem value="Shopee">Shopee</SelectItem>
                <SelectItem value="Free">Free</SelectItem>
                <SelectItem value="Complain">Complain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label>Location</Label>
          <Select
            value={location}
            onValueChange={(v) => setLocation(v)}
            disabled={Boolean(lockedLocation(user)) && !hasRole(user, "BDGSales")}
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
        <div className="flex flex-col gap-1">
          <Label>Search</Label>
          <Input
            placeholder="Search by ID, outlet, location, customer, status..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          />
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
      <div className="flex flex-wrap gap-3">
        <Button onClick={openModal}>Create Order</Button>
        <Button variant="outline" onClick={() => {
          setFrom(undefined);
          setTo(undefined);
          setSearch("");
          setPage(1);
        }}>
          Clear Filters
        </Button>
      </div>

      {/* Create Order Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingOrderId ? `Edit Order #${editingOrderId}` : `Create Order`} - {editingOrderId ? editingOutlet : outlet} ({editingOrderId ? editingLocation : location})
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Outlet selector (enabled in edit mode) */}
            {!isWhatsAppPage && (
              <div className="flex flex-col gap-1">
                <Label>Outlet</Label>
                <Select 
                  value={currentModalOutlet} 
                  onValueChange={handleModalOutletChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tokopedia">Tokopedia</SelectItem>
                  <SelectItem value="Shopee">Shopee</SelectItem>
                  <SelectItem value="Free">Free</SelectItem>
                  <SelectItem value="Complain">Complain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            )}
            <div className="flex flex-col gap-1">
              <Label>
                {currentModalOutlet === "Tokopedia" || currentModalOutlet === "Shopee" ? "ID Pesanan *" : 
                 currentModalOutlet === "WhatsApp" ? "No. HP *" : "Customer *"}
              </Label>
              <Input 
                placeholder={
                  currentModalOutlet === "Tokopedia" || currentModalOutlet === "Shopee" ? "Masukkan ID Pesanan" :
                  currentModalOutlet === "WhatsApp" ? "Masukkan No. HP" : "Customer"
                } 
                value={form.customer} 
                onChange={(e) => setForm({ ...form, customer: e.target.value })} 
              />
            </div>
            {!isWhatsAppModal && (
              <div className="flex flex-col gap-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: normalizeOrderStatus(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUS_OPTIONS.map((statusOption) => (
                      <SelectItem key={statusOption} value={statusOption}>
                        {statusOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label>Order Date</Label>
              <DateTimePicker
                value={form.orderDate || undefined}
                onChange={(date) => setForm({ ...form, orderDate: date || null })}
                placeholder="Select order date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Delivery Date</Label>
              <DateTimePicker
                value={form.deliveryDate || undefined}
                onChange={(date) => setForm({ ...form, deliveryDate: date || null })}
                placeholder="Select delivery date"
              />
            </div>
            {isWhatsAppModal && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Label>Ongkir Plan (Rp)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 10000"
                    value={form.ongkirPlan}
                    onChange={(e) => setForm({ ...form, ongkirPlan: e.target.value })}
                    disabled={form.selfPickup}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.selfPickup}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        selfPickup: e.target.checked,
                        ongkirPlan: e.target.checked ? "" : prev.ongkirPlan,
                      }))
                    }
                  />
                  <span>Self pickup (tanpa ongkir)</span>
                </label>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label>Discount %</Label>
              <Input type="number" placeholder="e.g. 10" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            {outletHasActPayout(currentModalOutlet) && (
              <>
                <div className="flex flex-col gap-1">
                  <Label>Estimasi Total (Rp)</Label>
                  <Input className="bg-gray-50" value={calculateTotal().toLocaleString("id-ID")} readOnly />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Potongan % (auto)</Label>
                  <Input className="bg-gray-50" value={(function(){
                    const est = calculateTotal(); 
                    const act = Number(form.actPayout||0);
                    if (!est || !act) return "";
                    const pct = Math.max(0, Math.round(((est - act) / est) * 1000) / 10);
                    return String(pct);
                  })()} readOnly />
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Actual diterima (Rp)</Label>
                  <Input type="number" placeholder="e.g. 100000" value={form.actPayout} onChange={(e) => setForm({ ...form, actPayout: e.target.value })} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium">Order Items</div>
              <Button 
                onClick={openProductModal} 
                type="button"
                disabled={isEditingDelivered}
              >
                Add Item
              </Button>
            </div>
            {isEditingDelivered && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                ⚠️ This order has been delivered. Items cannot be modified.
              </div>
            )}
            <div className="overflow-x-auto">
              <div className="max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Product</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item, idx) => (
                      <TableRow key={`${item.productId}-${idx}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.product?.name || "Unknown Product"}</div>
                            <div className="text-sm text-gray-500">{item.product?.code || "N/A"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {item.product?.price ? item.product.price.toLocaleString("id-ID") : "0"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.product?.price ? (item.product.price * item.quantity).toLocaleString("id-ID") : "0"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button 
                            variant="link" 
                            className="text-red-600 p-0 h-auto" 
                            onClick={() => removeItem(idx)}
                            disabled={isEditingDelivered}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            {selectedItems.length > 0 && (
              <div className="text-right font-medium">
                Total: Rp {calculateTotal().toLocaleString("id-ID")}
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} type="button" disabled={isSubmitting}>Cancel</Button>
            <Button className="disabled:opacity-50" onClick={submitOrder} type="button" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Selection Modal */}
      <Dialog open={isProductModalOpen} onOpenChange={setIsProductModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <Label>Product</Label>
              <Select value={selectedProduct?.id.toString() || ""} onValueChange={(value) => {
                if (value === "loading" || value === "no-products") return;
                const product = products.find(p => p.id.toString() === value);
                setSelectedProduct(product || null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {productsLoading ? (
                    <SelectItem value="loading" disabled>Loading products...</SelectItem>
                  ) : products.length > 0 ? (
                    products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} ({product.code}) - Rp {product.price.toLocaleString("id-ID")}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-products" disabled>No products available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Quantity</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
          </div>
          {error && (
            <div className="text-sm text-red-600">{error}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductModalOpen(false)} type="button">Cancel</Button>
            <Button onClick={addProduct} type="button">Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Box prompt dialog */}
      <Dialog open={Boolean(boxPrompt)} onOpenChange={(open) => { if (!open) setBoxPrompt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah BOX?</DialogTitle>
          </DialogHeader>
          {boxPrompt && (
            <div className="space-y-3">
              <div>Item: {boxPrompt.targetCode}</div>
              <div className="text-sm text-gray-700">Tambah {boxPrompt.boxCode} dengan harga Rp {boxPrompt.boxPrice.toLocaleString("id-ID")}?</div>
            </div>
          )}
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBoxPrompt(null)}>No Box</Button>
            <Button onClick={addBoxFromPrompt}>Tambah BOX</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h2 className="font-medium mb-2">Recent Orders</h2>
        <div className="overflow-x-auto">
        <Table className="min-w-[720px] md:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">ID</TableHead>
              <TableHead className="text-left">Outlet</TableHead>
              <TableHead className="text-left hidden md:table-cell">Location</TableHead>
              <TableHead className="text-left hidden md:table-cell">Customer</TableHead>
              <TableHead className="text-left">Order Date</TableHead>
              <TableHead className="text-left">Delivery Date</TableHead>
              <TableHead className="text-left">Status</TableHead>
              <TableHead className="text-left hidden md:table-cell">Delivery</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const statusLabel = normalizeOrderStatus(order.status);
              return (
                <TableRow key={order.id}>
                  <TableCell>{order.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{order.outlet}</span>
                    {outletHasActPayout(order.outlet) && (
                      <Badge color={order.actPayout && Number(order.actPayout) > 0 ? "green" : "red"}>
                        {order.actPayout && Number(order.actPayout) > 0 
                          ? `Rp ${Number(order.actPayout).toLocaleString("id-ID")}` 
                          :"Actual Kosong"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{order.location}</TableCell>
                <TableCell className="hidden md:table-cell">{order.customer || "-"}</TableCell>
                <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                <TableCell>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "-"}</TableCell>
                <TableCell>
                  <Badge color={getStatusBadgeColor(statusLabel)}>
                    {statusLabel}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge color={
                    order.deliveries && order.deliveries.length > 0 
                      ? (order.deliveries[0].status === "delivered" ? "green" : "gray")
                      : "gray"
                  }>
                    {order.deliveries && order.deliveries.length > 0 
                      ? order.deliveries[0].status 
                      : "Not Delivered"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {order.totalAmount ? `Rp ${order.totalAmount.toLocaleString("id-ID")}` : "-"}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex gap-3 justify-center">
                    <Button 
                      variant="link" 
                      className="p-0 h-auto"
                      onClick={() => handleViewOrder(order.id)}
                    >
                      View
                    </Button>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto"
                      onClick={() => handleEditOrder(order.id)}
                    >
                      Edit
                    </Button>
                    {order.outlet.toLowerCase() === "whatsapp" && normalizeOrderStatus(order.status) === "NOT PAID" && (
                      <Button
                        variant="link"
                        className="p-0 h-auto text-emerald-700"
                        onClick={() => handleManualPaid(order.id)}
                        disabled={manualProcessingId === order.id}
                      >
                        {manualProcessingId === order.id ? "Marking..." : "Manual Paid"}
                      </Button>
                    )}
                    {user?.role === "Admin" && (
                      <Button 
                        variant="link" 
                        className="text-red-600 p-0 h-auto"
                        onClick={() => handleDeleteOrder(order.id)}
                        disabled={order.deliveries && order.deliveries.length > 0}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-gray-600">Page {page} / {Math.max(1, Math.ceil(total / 10))}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
            <Button variant="outline" onClick={() => setPage((p) => (p * 10 < total ? p + 1 : p))} disabled={page * 10 >= total}>Next</Button>
          </div>
        </div>
      </div>
    </main>
  );
}
