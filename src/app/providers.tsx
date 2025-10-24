"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type Role = "Admin" | "Manager" | "Sales" | "Bandung" | "Jakarta";
type AuthState = { username: Role | null; setUsername: (u: Role | null) => void };

const AuthContext = createContext<AuthState>({ username: null, setUsername: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [username, setUsernameState] = useState<Role | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem("mf_username") as Role | null) : null;
    if (stored) setUsernameState(stored);
  }, []);

  const setUsername = (u: Role | null) => {
    setUsernameState(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem("mf_username", u);
      else localStorage.removeItem("mf_username");
    }
  };

  const value = useMemo(() => ({ username, setUsername }), [username]);

  // Minimal guard: redirect to /login when not logged in and visiting app pages
  useEffect(() => {
    if (!username && pathname !== "/login") {
      router.replace("/login");
    }
  }, [username, pathname, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function hasAccess(
  username: Role | null,
  page: "products" | "inventory" | "orders" | "delivery" | "reports" | "finance",
): boolean {
  if (!username) return false;
  const u = String(username).toLowerCase();
  if (u === "admin") return true;
  if (u === "manager") return page === "reports";
  if (u === "sales") return page === "inventory" || page === "orders";
  if (u === "bandung" || u === "jakarta") return page === "inventory" || page === "delivery";
  return false;
}

export function lockedLocation(username: Role | null): "Bandung" | "Jakarta" | null {
  const u = String(username || "").toLowerCase();
  if (u === "bandung") return "Bandung";
  if (u === "jakarta") return "Jakarta";
  return null;
}
