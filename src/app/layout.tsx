import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./providers";
import AppShell from "../components/app-shell";

export const metadata: Metadata = {
  title: "Mugifumi Corps",
  description: "Mugifumi Corps Internal Management System",
  icons: {
    icon: [{ url: "/assets/Logo%20Only.png", type: "image/png" }],
    shortcut: [{ url: "/assets/Logo%20Only.png" }],
    apple: [{ url: "/assets/Logo%20Only.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
