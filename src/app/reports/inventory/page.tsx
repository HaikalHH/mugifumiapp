"use client";
import { useCallback, useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { useAuth } from "../../providers";

export default function ReportsInventoryPage() {
  const { user } = useAuth();
  const [inv, setInv] = useState<any>(null);

  const load = useCallback(async () => {
    const a = await fetch(`/api/reports/inventory`).then((r) => r.json());
    setInv(a);
  }, []);

  useEffect(() => { if (user?.role === "Admin" || user?.role === "Manager") load(); }, [load, user]);

  if (user?.role !== "Admin" && user?.role !== "Manager") {
    return <main className="p-6"><div className="text-sm text-gray-600">Akses ditolak.</div></main>;
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Reports · Inventory</h1>

      {/* No period filter required for inventory report */}

      <section>
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
    </main>
  );
}
