"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../providers";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { DateTimePicker } from "../../../components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { getEndOfDayJakarta, getStartOfDayJakarta } from "../../../lib/timezone";

type MenuItemRow = {
  productCode: string;
  productName: string;
  productPrice: number;
  totalQuantity: number;
  totalRevenue: number;
  totalHppValue: number;
  averagePrice: number;
  outlets: string[];
  locations: string[];
};

type MenuData = {
  menuItems?: MenuItemRow[];
  totals?: {
    totalItems?: number;
    totalRevenue?: number;
    totalHppValue?: number;
    totalProfit?: number;
    uniqueProducts?: number;
  };
};

export default function ReportsGrossSalesCogsPage() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuData | null>(null);
  const [from, setFrom] = useState<Date | undefined>(undefined);
  const [to, setTo] = useState<Date | undefined>(undefined);
  const [menuLocation, setMenuLocation] = useState("all");
  const [menuOutlet, setMenuOutlet] = useState("all");

  const loadMenuItems = useCallback(async () => {
    const qs: string[] = [];
    if (from) qs.push(`from=${encodeURIComponent(getStartOfDayJakarta(from).toISOString())}`);
    if (to) qs.push(`to=${encodeURIComponent(getEndOfDayJakarta(to).toISOString())}`);
    if (menuLocation !== "all") qs.push(`location=${encodeURIComponent(menuLocation)}`);
    if (menuOutlet !== "all") qs.push(`outlet=${encodeURIComponent(menuOutlet)}`);
    const query = qs.length ? `?${qs.join("&")}` : "";
    const data = await fetch(`/api/reports/menu-items${query}`).then((r) => r.json());
    setMenuItems(data);
  }, [from, to, menuLocation, menuOutlet]);

  useEffect(() => {
    if (user?.role === "Admin" || user?.role === "Manager") {
      loadMenuItems();
    }
  }, [loadMenuItems, user]);

  if (user?.role !== "Admin" && user?.role !== "Manager") {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Reports · Gross Sales & COGS</h1>
      <p className="text-xl font-semibold">REPORT DIBAWAH ADALAH JUMLAH ROTI YANG KELUAR TERMASUK WASTE & TIDAK KENA POTONGAN</p>

      <section>
        <h2 className="font-medium mb-2">Periode</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <Label>From</Label>
            <DateTimePicker value={from} onChange={setFrom} placeholder="Select start date" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>To</Label>
            <DateTimePicker value={to} onChange={setTo} placeholder="Select end date" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-4">Gross Sales & COGS</h2>
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
            <Button variant="outline" onClick={() => { setMenuLocation("all"); setMenuOutlet("all"); }}>Clear Filters</Button>
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
                {menuItems && menuItems.menuItems && menuItems.menuItems.slice(0, 3).map((item: MenuItemRow) => (
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
                    <TableCell className="text-right">Rp {(item.productPrice ?? item.averagePrice ?? 0).toLocaleString("id-ID")}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.outlets.map((outlet: string) => (<Badge key={outlet} color="gray" className="text-xs">{outlet}</Badge>))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

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
                  {menuItems.menuItems.map((item: MenuItemRow) => (
                    <TableRow key={item.productCode}>
                      <TableCell className="font-mono text-sm">{item.productCode}</TableCell>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-right font-medium">{item.totalQuantity}</TableCell>
                      <TableCell className="text-right">Rp {item.totalRevenue.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right">Rp {item.totalHppValue.toLocaleString("id-ID")}</TableCell>
                      <TableCell className="text-right">Rp {(item.productPrice ?? item.averagePrice ?? 0).toLocaleString("id-ID")}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.outlets.map((outlet: string) => (
                            <Badge key={outlet} color="gray" className="text-xs">{outlet}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.locations.map((location: string) => (
                            <Badge key={location} color="green" className="text-xs">{location}</Badge>
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
