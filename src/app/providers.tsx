"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export type Role = "Admin" | "Manager" | "Sales" | "Bandung" | "Jakarta" | "Baker";
export type AppUser = { id: number; username: string; name: string; role: Role };

type AuthState = {
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
};

const AuthContext = createContext<AuthState>({ user: null, setUser: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("mf_user");
      if (raw) {
        const parsed = JSON.parse(raw) as AppUser;
        setUserState(parsed);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const setUser = (u: AppUser | null) => {
    setUserState(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem("mf_user", JSON.stringify(u));
      else localStorage.removeItem("mf_user");
    }
  };

  const value = useMemo(() => ({ user, setUser }), [user]);

  // Minimal guard: redirect to /login when not logged in and visiting app pages
  useEffect(() => {
    if (!hydrated) return; // wait for localStorage hydration
    if (!user && pathname !== "/login" && pathname !== "/forgot") {
      router.replace("/login");
    }
  }, [user, pathname, router, hydrated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function hasAccess(
  user: AppUser | null,
  page:
    | "products"
    | "inventory"
    | "orders"
    | "delivery"
    | "reports"
    | "finance"
    | "users"
    | "attendance"
    | "overtime"
    | "overtimeApprovals"
    | "payroll",
): boolean {
  if (!user) return false;
  const u = String(user.role).toLowerCase();

  // Admin: no Attendance or Overtime (staff feature). Has approvals + payroll and others.
  if (u === "admin") {
    if (page === "attendance" || page === "overtime") return false;
    return true; // products, inventory, orders, delivery, reports, finance, users, overtimeApprovals, payroll
  }

  // Staff-only menus
  if (page === "attendance") return u === "sales" || u === "bandung" || u === "jakarta" || u === "baker";
  if (page === "overtime") return u === "sales" || u === "bandung" || u === "jakarta" || u === "baker";
  if (page === "overtimeApprovals" || page === "payroll" || page === "users") return false;

  // Existing menus by role
  if (u === "manager") return page === "reports";
  if (u === "sales") return page === "inventory" || page === "orders";
  if (u === "baker") return page === "inventory"; // Baker: inventory only (plus attendance/overtime above)
  if (u === "bandung" || u === "jakarta") return page === "inventory" || page === "delivery";
  return false;
}

export function lockedLocation(roleOrUser: Role | AppUser | null): "Bandung" | "Jakarta" | null {
  const r = (roleOrUser && typeof roleOrUser === "object" ? roleOrUser.role : roleOrUser) as Role | null;
  const u = String(r || "").toLowerCase();
  if (u === "bandung") return "Bandung";
  if (u === "jakarta") return "Jakarta";
  return null;
}
