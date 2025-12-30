"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export type Role = "Admin" | "Manager" | "Sales" | "Bandung" | "Jakarta" | "Baker" | "BDGSales";
export type AppUser = { id: number; username: string; name: string; role: Role | string };

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

  const isPublicRoute = typeof pathname === "string" && pathname.startsWith("/midtrans");

  // Minimal guard: redirect to /login when not logged in and visiting app pages
  useEffect(() => {
    if (!hydrated) return; // wait for localStorage hydration
    if (!user && pathname !== "/login" && pathname !== "/forgot" && !isPublicRoute) {
      router.replace("/login");
    }
  }, [user, pathname, router, hydrated, isPublicRoute]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

function roleTokens(val: string | null | undefined): string[] {
  if (!val) return [];
  const raw = String(val)
    .split(/[^A-Za-z]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set(raw);
  if (set.has("bdgsales")) {
    set.add("bandung");
    set.add("sales");
  }
  return Array.from(set);
}

export function hasRole(user: AppUser | null, role: Role): boolean {
  if (!user) return false;
  const set = new Set(roleTokens(user.role as string));
  return set.has(String(role).toLowerCase());
}

export function hasAnyRole(user: AppUser | null, roles: Role[]): boolean {
  return roles.some((r) => hasRole(user, r));
}

export function hasAccess(
  user: AppUser | null,
  page:
    | "products"
    | "planProducts"
    | "inventory"
    | "orders"
    | "delivery"
    | "reports"
    | "finance"
    | "users"
    | "attendance"
    | "overtime"
    | "overtimeApprovals"
    | "payroll"
    | "slip"
    | "bonus"
    | "planning",
): boolean {
  if (!user) return false;
  const roles = new Set(roleTokens(user.role as string));

  if (page === "planProducts") {
    return roles.has("admin");
  }
  // Admin: no Attendance or Overtime (staff feature). Has approvals + payroll and others.
  if (roles.has("admin")) {
    if (page === "attendance" || page === "overtime") return false;
    if (page === "slip") return false; // slip gaji bukan untuk Admin
    if (page === "planning") return false; // Planning only for Baker & Manager
    return true; // products, inventory, orders, delivery, reports, finance, users, overtimeApprovals, payroll, bonus
  }

  // Staff-only menus
  if (page === "attendance") return ["sales","bandung","jakarta","baker"].some((r) => roles.has(r));
  if (page === "overtime") return ["sales","bandung","jakarta","baker"].some((r) => roles.has(r));
  if (page === "overtimeApprovals" || page === "payroll" || page === "users" || page === "bonus") return false;

  // Existing menus by role
  if (roles.has("manager")) return page === "reports" || page === "planning";
  if (roles.has("sales")) return page === "inventory" || page === "orders";
  if (roles.has("baker")) return page === "inventory" || page === "slip" || page === "planning";
  if (roles.has("bandung") || roles.has("jakarta")) {
    if (page === "inventory" || page === "delivery") return true;
    if (page === "slip") return true;
    return false;
  }
  if (roles.has("bdgsales")) {
    // Attendance/Overtime already handled above via tokens (bdgsales includes 'sales' and 'bandung')
    if (page === "slip") return true;
    return false;
  }
  return false;
}

export function lockedLocation(roleOrUser: Role | AppUser | null): "Bandung" | "Jakarta" | null {
  const r = (roleOrUser && typeof roleOrUser === "object" ? (roleOrUser as AppUser).role : roleOrUser) as string | null;
  const tokens = roleTokens(r || "");
  if (tokens.includes("bandung")) return "Bandung";
  if (tokens.includes("jakarta")) return "Jakarta";
  return null;
}
