"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!username.trim() || !newPassword || !confirm) {
      setError("Isi semua field");
      return;
    }
    if (newPassword !== confirm) {
      setError("Password dan konfirmasi tidak sama");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengubah password");
        return;
      }
      setMessage("Password berhasil diubah. Silakan login.");
      setTimeout(() => router.replace("/login"), 1500);
    } catch (err) {
      setError("Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Forgot Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input placeholder="Masukkan username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <Input type="password" placeholder="Password baru" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Konfirmasi Password</Label>
              <Input type="password" placeholder="Ulangi password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            {message && <div className="text-sm text-green-600">{message}</div>}
            <div className="flex items-center gap-3">
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Saving..." : "Simpan"}</Button>
              <Button type="button" variant="outline" className="flex-1" onClick={() => router.replace("/login")}>Kembali</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}

