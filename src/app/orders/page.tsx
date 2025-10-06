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
  location: string; 
  orderDate: string; 
  customer?: string | null; 
  status: string;
  totalAmount?: number | null;
  discount?: number | null;
  actPayout?: number | null;
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

import { useAuth, lockedLocation } from "../providers";

function getInitialLocation(): string {
  if (typeof window !== "undefined") {
    const u = localStorage.getItem("mf_username");
    const locked = lockedLocation((u as any) || null);
    if (locked) return locked;
  }
  return "Bandung";
}

export default function OrdersPage() {
  const { username } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [outlet, setOutlet] = useState("WhatsApp");
  const [location, setLocation] = useState<string>(() => getInitialLocation());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Modal form state
  const [form, setForm] = useState({
    customer: "",
    status: "confirmed",
    orderDate: new Date(),
    discount: "",
    estPayout: "",
    actPayout: "",
  });
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingOutlet, setEditingOutlet] = useState<string>("");
  const [editingLocation, setEditingLocation] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Array<{ productId: number; quantity: number; product: Product }>>([]);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product selection state
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);

  const loadOrders = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (from) params.set("from", from.toISOString());
    if (to) params.set("to", to.toISOString());
    const res = await fetch(`/api/orders?${params.toString()}`);
    const data = await res.json();
    setOrders(data.rows || []);
    setTotal(data.total || 0);
  };

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

  useEffect(() => { loadOrders(); }, [page, from, to]);
  useEffect(() => { loadProducts(); }, []);

  // lock location for Bandung/Jakarta
  useEffect(() => {
    const locked = lockedLocation(username);
    if (locked) setLocation(locked);
  }, [username]);

  const openModal = () => {
    setEditingOrderId(null); // Reset editing state
    setEditingOutlet(""); // Reset editing outlet
    setEditingLocation(""); // Reset editing location
    setForm({
      customer: "",
      status: "confirmed",
      orderDate: new Date(),
      discount: "",
      estPayout: "",
      actPayout: "",
    });
    setSelectedItems([]);
    setIsModalOpen(true);
  };

  const openProductModal = () => {
    setSelectedProduct(null);
    setQuantity(1);
    setIsProductModalOpen(true);
  };

  const addProduct = () => {
    if (!selectedProduct) {
      setError("Please select a product");
      return;
    }
    if (quantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }
    
    setError("");
    setSelectedItems(prev => [...prev, { 
      productId: selectedProduct.id, 
      quantity, 
      product: selectedProduct 
    }]);
    setIsProductModalOpen(false);
  };

  const removeItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleViewOrder = (orderId: number) => {
    // Find the order and show details
    const order = orders.find(o => o.id === orderId);
    if (order) {
      alert(`View Order #${orderId}\nOutlet: ${order.outlet}\nCustomer: ${order.customer || '-'}\nStatus: ${order.status}\nTotal: Rp ${order.totalAmount?.toLocaleString('id-ID') || '0'}`);
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
        status: order.status,
        orderDate: new Date(order.orderDate),
        discount: order.discount?.toString() || "",
        estPayout: "",
        actPayout: order.actPayout?.toString() || "",
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

  const submitOrder = async () => {
    setError("");
    
    if (!form.customer.trim()) {
      setError("Customer wajib diisi");
      return;
    }
    if (selectedItems.length === 0) {
      setError("Tambah minimal 1 item terlebih dahulu");
      return;
    }

    const payload: any = {
      outlet: editingOrderId ? editingOutlet : outlet,
      location: editingOrderId ? editingLocation : location,
      customer: form.customer,
      status: form.status,
      orderDate: form.orderDate.toISOString(),
      discount: form.discount ? Number(form.discount) : null,
      actPayout: ((editingOrderId ? editingOutlet : outlet) === "Tokopedia" || (editingOrderId ? editingOutlet : outlet) === "Shopee") && form.actPayout ? Number(form.actPayout) : null,
      items: selectedItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
    };

    setIsSubmitting(true);
    const url = editingOrderId ? `/api/orders/${editingOrderId}` : "/api/orders";
    const method = editingOrderId ? "PUT" : "POST";
    
    const res = await fetch(url, { 
      method, 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(payload) 
    });
    
    if (res.ok) {
      // Send WhatsApp notification only on create (not on edit)
      if (!editingOrderId) {
        try {
          const dest = (editingOrderId ? editingLocation : location) === "Jakarta" ? "628986723926" : "6281320699662";
          const orderOutlet = editingOrderId ? editingOutlet : outlet;
          const orderLocation = editingOrderId ? editingLocation : location;
          const orderCustomer = form.customer || "-";
          const orderTotal = calculateTotal();
          const lines = selectedItems.map((it) => {
            const name = it.product?.name || `#${it.productId}`;
            const price = it.product?.price || 0;
            const subtotal = price * it.quantity;
            return `- ${name} x${it.quantity} @ Rp ${price.toLocaleString("id-ID")} = Rp ${subtotal.toLocaleString("id-ID")}`;
          });
          const msg = [
            "Notifikasi Order Baru",
            `Outlet: ${orderOutlet}`,
            `Region: ${orderLocation}`,
            `Customer: ${orderCustomer}`,
            "Items:",
            ...lines,
            `Total: Rp ${orderTotal.toLocaleString("id-ID")}`,
          ].join("\n");
          const url = `https://wa.me/${dest}?text=${encodeURIComponent(msg)}`;
          if (typeof window !== "undefined") {
            window.open(url, "_blank");
          }
        } catch {}
      }
      setIsModalOpen(false);
      loadOrders();
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error || "Failed to create order");
    }
    setIsSubmitting(false);
  };

  const calculateTotal = () => {
    const subtotal = selectedItems.reduce((acc, item) => {
      const price = item.product?.price || 0;
      return acc + (price * item.quantity);
    }, 0);
    const discount = form.discount ? Number(form.discount) : 0;
    return discount > 0 ? Math.round(subtotal * (1 - discount / 100)) : subtotal;
  };

  const editingOrder = editingOrderId ? orders.find(o => o.id === editingOrderId) : null;
  const isEditingDelivered = Boolean(editingOrder?.deliveries && editingOrder.deliveries.length > 0);

  if (username === "Bandung" || username === "Jakarta") {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Orders</h1>
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
              <SelectItem value="Free">Free</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Location</Label>
          <Select value={location} onValueChange={(v) => setLocation(v)} disabled={Boolean(lockedLocation(username))}>
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
        <Button onClick={openModal}>Create Order</Button>
        <Button variant="outline" onClick={() => {
          setFrom(undefined);
          setTo(undefined);
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
            <div className="flex flex-col gap-1">
              <Label>Outlet</Label>
              <Select 
                value={(editingOrderId ? editingOutlet : outlet)} 
                onValueChange={(v) => {
                  if (editingOrderId) setEditingOutlet(v); else setOutlet(v);
                }}
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
                  <SelectItem value="Free">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>
                {(editingOrderId ? editingOutlet : outlet) === "Tokopedia" || (editingOrderId ? editingOutlet : outlet) === "Shopee" ? "ID Pesanan *" : 
                 (editingOrderId ? editingOutlet : outlet) === "WhatsApp" ? "No. HP *" : "Customer *"}
              </Label>
              <Input 
                placeholder={
                  (editingOrderId ? editingOutlet : outlet) === "Tokopedia" || (editingOrderId ? editingOutlet : outlet) === "Shopee" ? "Masukkan ID Pesanan" :
                  (editingOrderId ? editingOutlet : outlet) === "WhatsApp" ? "Masukkan No. HP" : "Customer"
                } 
                value={form.customer} 
                onChange={(e) => setForm({ ...form, customer: e.target.value })} 
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Status</Label>
              <Input value="Confirmed" readOnly className="bg-gray-50" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Order Date</Label>
              <DateTimePicker
                value={form.orderDate}
                onChange={(date) => setForm({ ...form, orderDate: date || new Date() })}
                placeholder="Select order date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Discount %</Label>
              <Input type="number" placeholder="e.g. 10" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </div>
            {((editingOrderId ? editingOutlet : outlet) === "Tokopedia" || (editingOrderId ? editingOutlet : outlet) === "Shopee") && (
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

      <div>
        <h2 className="font-medium mb-2">Recent Orders</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">ID</TableHead>
              <TableHead className="text-left">Outlet</TableHead>
              <TableHead className="text-left">Location</TableHead>
              <TableHead className="text-left">Customer</TableHead>
              <TableHead className="text-left">Order Date</TableHead>
              <TableHead className="text-left">Status</TableHead>
              <TableHead className="text-left">Delivery</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span>{order.outlet}</span>
                    {(order.outlet === "Tokopedia" || order.outlet === "Shopee") && (
                      <Badge color={order.actPayout && Number(order.actPayout) > 0 ? "green" : "red"}>
                        {order.actPayout && Number(order.actPayout) > 0 ? "Paid" : "Not Paid"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{order.location}</TableCell>
                <TableCell>{order.customer || "-"}</TableCell>
                <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge color={order.status === "confirmed" ? "green" : order.status === "cancelled" ? "red" : "gray"}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
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
                    {username === "Admin" && (
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
    </main>
  );
}
