"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers";
import { useState } from "react";
import Image from "next/image";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function LoginPage() {
  const { setUser } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Masukkan username dan password");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal login");
        return;
      }
      setUser(data);
      router.replace("/");
    } catch (err) {
      setError("Gagal login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <Card>
          <CardHeader className="items-center">
            <Image
              src="/assets/Logo Square.jpg"
              alt="Mugifumi Logo"
              width={80}
              height={80}
              className="rounded-lg"
              priority
            />
            <CardTitle>Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input placeholder="Masukkan username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="Masukkan password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex items-center justify-between gap-3">
              <Button className="flex-1" type="submit" disabled={loading}>{loading ? "Logging in..." : "Masuk"}</Button>
              <Button asChild variant="outline" className="flex-1">
                <a href="/forgot">Forgot Password</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
