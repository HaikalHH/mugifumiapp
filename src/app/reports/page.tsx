"use client";
import { useEffect, useState } from "react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { DatePickerFilter } from "../../components/ui/date-picker";
import { useAuth } from "../providers";

export default function ReportsPage() {
  const { username } = useAuth();
  const [inv, setInv] = useState<any>(null);
  const [sales, setSales] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [menuLocation, setMenuLocation] = useState("");
  const [menuOutlet, setMenuOutlet] = useState("");

  const load = async () => {
    const qs: string[] = [];
    if (from) qs.push(`from=${encodeURIComponent(new Date(from).toISOString())}`);
    if (to) qs.push(`to=${encodeURIComponent(new Date(to).toISOString())}`);
    const query = qs.length ? `?${qs.join("&")}` : "";
    const [a, b, c] = await Promise.all([
      fetch(`/api/reports/inventory${query}`).then((r) => r.json()),
      fetch(`/api/reports/sales${query}`).then((r) => r.json()),
      fetch(`/api/reports/menu-items${query}`).then((r) => r.json()),
    ]);
    setInv(a);
    setSales(b);
    setMenuItems(c);
  };

  const loadMenuItems = async () => {
    const qs: string[] = [];
    if (from) qs.push(`from=${encodeURIComponent(new Date(from).toISOString())}`);
    if (to) qs.push(`to=${encodeURIComponent(new Date(to).toISOString())}`);
    if (menuLocation) qs.push(`location=${encodeURIComponent(menuLocation)}`);
    if (menuOutlet) qs.push(`outlet=${encodeURIComponent(menuOutlet)}`);
    const query = qs.length ? `?${qs.join("&")}` : "";
    const response = await fetch(`/api/reports/menu-items${query}`);
    const data = await response.json();
    setMenuItems(data);
  };

  useEffect(() => { 
    if (username === "Admin" || username === "Manager") {
      load(); 
    }
  }, [from, to, username]);
  
  useEffect(() => { 
    if (username === "Admin" || username === "Manager") {
      loadMenuItems(); 
    }
  }, [menuLocation, menuOutlet, username]);

  if (username !== "Admin" && username !== "Manager") {
    return (
      <main className="p-6">
        <div className="text-sm text-gray-600">Akses ditolak.</div>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Reports</h1>

      <section>
        <h2 className="font-medium mb-2">Inventory</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <Label>Periode From</Label>
            <DatePickerFilter 
              value={from ? new Date(from + 'T00:00:00') : undefined} 
              onChange={(date) => { 
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  setFrom(`${year}-${month}-${day}`);
                } else {
                  setFrom('');
                }
              }} 
              placeholder="Pilih tanggal mulai"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Periode To</Label>
            <DatePickerFilter 
              value={to ? new Date(to + 'T00:00:00') : undefined} 
              onChange={(date) => { 
                if (date) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  setTo(`${year}-${month}-${day}`);
                } else {
                  setTo('');
                }
              }} 
              placeholder="Pilih tanggal akhir"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium">By Location</h3>
            {inv && Object.entries(inv.byLocation).map(([loc, rows]: any) => (
              <div key={loc} className="mb-4">
                <div className="font-medium">{loc}</div>
                <Table>
                  <TableBody>
                    {Object.entries(rows as any).map(([k, v]: any) => (
                      <TableRow key={k}>
                        <TableCell>{k}</TableCell>
                        <TableCell className="text-right">{v as number}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-medium">All</h3>
            <Table>
              <TableBody>
                {inv && Object.entries(inv.all).map(([k, v]: any) => (
                  <TableRow key={k}>
                    <TableCell>{k}</TableCell>
                    <TableCell className="text-right">{v as number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-2">Sales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium">By Outlet</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Outlet</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Actual (Rp)</TableHead>
                  <TableHead className="text-right">Potongan %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales && Object.entries(sales.byOutlet).map(([k, v]: any) => (
                  <TableRow key={k}>
                    <TableCell>{k}</TableCell>
                    <TableCell className="text-right">{v.count}</TableCell>
                    <TableCell className="text-right">{(v.actual ?? 0).toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right">{v.potonganPct != null ? `${v.potonganPct}%` : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <h3 className="font-medium">Totals</h3>
            <div className="space-y-2 border rounded p-4">
              <div>Actual total: {sales ? sales.totalActual.toLocaleString("id-ID") : 0}</div>
              <div>Rata-rata potongan %: {sales && sales.avgPotonganPct != null ? `${sales.avgPotonganPct}%` : "-"}</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-medium mb-2">Outlet Share (%)</h3>
          {sales && sales.byOutlet && Object.keys(sales.byOutlet).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(sales.byOutlet).map(([name, v]: any) => (
                <div key={name} className="flex items-center justify-between">
                  <span>{name}</span>
                  <span className="tabular-nums">
                    {sales.totalActual > 0 ? `${Math.round(((v.actual || 0) / sales.totalActual) * 1000) / 10}%` : "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Tidak ada data.</div>
          )}
        </div>

        {/* recent sales table removed as requested */}
      </section>

      <section>
        <h2 className="font-medium mb-2">Menu Items Sold</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <Label>Filter by Location</Label>
            <select 
              className="border rounded p-2" 
              value={menuLocation} 
              onChange={(e) => setMenuLocation(e.target.value)}
            >
              <option value="">All Locations</option>
              <option value="Bandung">Bandung</option>
              <option value="Jakarta">Jakarta</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Filter by Outlet</Label>
            <select 
              className="border rounded p-2" 
              value={menuOutlet} 
              onChange={(e) => setMenuOutlet(e.target.value)}
            >
              <option value="">All Outlets</option>
              <option value="TOKOPEDIA">Tokopedia</option>
              <option value="SHOPEE">Shopee</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="CAFE">Cafe</option>
              <option value="WHOLESALE">Wholesale</option>
              <option value="FREE">Free</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 justify-end">
            <button 
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm"
              onClick={() => {
                setMenuLocation("");
                setMenuOutlet("");
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium">Summary</h3>
            <div className="space-y-2 border rounded p-4">
              <div>Total Items Sold: {menuItems ? menuItems.totals?.totalItems || 0 : 0}</div>
              <div>Total Revenue: Rp {menuItems ? (menuItems.totals?.totalRevenue || 0).toLocaleString("id-ID") : 0}</div>
              <div>Total HPP Value: Rp {menuItems ? (menuItems.totals?.totalHppValue || 0).toLocaleString("id-ID") : 0}</div>
              <div>Unique Products: {menuItems ? menuItems.totals?.uniqueProducts || 0 : 0}</div>
            </div>
          </div>
          <div className="md:col-span-2">
            <h3 className="font-medium">Top Selling Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">HPP Value</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-left">Outlets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuItems && menuItems.menuItems && menuItems.menuItems.slice(0, 10).map((item: any) => (
                  <TableRow key={item.productCode}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-gray-500">{item.productCode}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{item.totalQuantity}</TableCell>
                    <TableCell className="text-right">Rp {item.totalRevenue.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right">Rp {item.totalHppValue.toLocaleString("id-ID")}</TableCell>
                    <TableCell className="text-right">Rp {item.averagePrice.toLocaleString("id-ID")}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.outlets.map((outlet: string) => (
                          <span key={outlet} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            {outlet}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Full menu items table */}
        {menuItems && menuItems.menuItems && menuItems.menuItems.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-2">All Menu Items</h3>
            <div className="border rounded overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Product Code</TableHead>
                    <TableHead className="text-left">Product Name</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">HPP Value</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-left">Outlets</TableHead>
                    <TableHead className="text-left">Locations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menuItems.menuItems.map((item: any) => (
                    <TableRow key={item.productCode}>
                      <TableCell className="font-mono text-sm">{item.productCode}</TableCell>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-right font-medium">{item.totalQuantity}</TableCell>
                      <TableCell className="text-right">Rp {item.totalRevenue.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right">Rp {item.totalHppValue.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right">Rp {item.averagePrice.toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.outlets.map((outlet: string) => (
                            <span key={outlet} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {outlet}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.locations.map((location: string) => (
                            <span key={location} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              {location}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}


