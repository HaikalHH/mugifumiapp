"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { useState } from "react";

export default function LoginPage() {
  const { setUsername } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = input.trim().toLowerCase();
    if (!u) { setError("Masukkan username"); return; }
    const allowed = ["admin", "manager", "bandung", "jakarta"];
    if (!allowed.includes(u)) {
      setError("Username tidak dikenal. Gunakan: Admin, Manager, Bandung, Jakarta");
      return;
    }
    // store in canonical case
    const canonical = u === "admin" ? "Admin" : u === "manager" ? "Manager" : u === "bandung" ? "Bandung" : "Jakarta";
    setUsername(canonical as any);
    router.replace("/");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm border rounded-md p-6 space-y-4">
        <div className="text-lg font-semibold text-center">Login</div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Username</label>
          <input className="border rounded p-2 w-full" placeholder="Admin / Manager / Bandung / Jakarta" value={input} onChange={(e) => setInput(e.target.value)} />
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <button className="w-full border rounded p-2 hover:bg-gray-50" type="submit">Masuk</button>
      </form>
    </main>
  );
}


