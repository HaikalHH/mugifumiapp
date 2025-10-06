"use client";
import { useEffect, useState } from "react";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { DateTimePicker } from "../../components/ui/date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { useAuth } from "../providers";

export default function ReportsPage() {
  const { username } = useAuth();
  const [inv, setInv] = useState<any>(null);
  const [sales, setSales] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any>(null);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [menuLocation, setMenuLocation] = useState("all");
  const [menuOutlet, setMenuOutlet] = useState("all");

  const load = async () => {
    const qs: string[] = [];
    if (from) qs.push(`from=${encodeURIComponent(from.toISOString())}`);
    if (to) qs.push(`to=${encodeURIComponent(to.toISOString())}`);
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
    if (from) qs.push(`from=${encodeURIComponent(from.toISOString())}`);
    if (to) qs.push(`to=${encodeURIComponent(to.toISOString())}`);
    if (menuLocation && menuLocation !== "all") qs.push(`location=${encodeURIComponent(menuLocation)}`);
    if (menuOutlet && menuOutlet !== "all") qs.push(`outlet=${encodeURIComponent(menuOutlet)}`);
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
            <DateTimePicker
              value={from}
              onChange={setFrom}
              placeholder="Select start date"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Periode To</Label>
            <DateTimePicker
              value={to}
              onChange={setTo}
              placeholder="Select end date"
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
            {sales && sales.byOutletRegion && Object.keys(sales.byOutletRegion).length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-1">By Outlet + Region</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Outlet + Region</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Actual (Rp)</TableHead>
                      <TableHead className="text-right">Potongan %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(sales.byOutletRegion).map(([k, v]: any) => (
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
            )}
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
            <Select value={menuLocation} onValueChange={setMenuLocation}>
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="Bandung">Bandung</SelectItem>
                <SelectItem value="Jakarta">Jakarta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Filter by Outlet</Label>
            <Select value={menuOutlet} onValueChange={setMenuOutlet}>
              <SelectTrigger>
                <SelectValue placeholder="All Outlets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                <SelectItem value="TOKOPEDIA">Tokopedia</SelectItem>
                <SelectItem value="SHOPEE">Shopee</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="CAFE">Cafe</SelectItem>
                <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                <SelectItem value="FREE">Free</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1 justify-end">
            <Button 
              variant="outline"
              onClick={() => {
                setMenuLocation("all");
                setMenuOutlet("all");
              }}
            >
              Clear Filters
            </Button>
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
                {menuItems && menuItems.menuItems && menuItems.menuItems.slice(0, 3).map((item: any) => (
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


