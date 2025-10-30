import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashPassword, verifyPassword } from "../../../../lib/auth";

// Hardcoded bootstrap superadmin
const SUPERADMIN_USERNAME = "Superadmin";
const SUPERADMIN_PASSWORD = "Poprusher1";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "Username dan password wajib diisi" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });

    if (!existing) {
      // Bootstrap Superadmin on first login with exact credentials
      if (username === SUPERADMIN_USERNAME && password === SUPERADMIN_PASSWORD) {
        const passwordHash = await hashPassword(password);
        const created = await prisma.user.create({
          data: {
            username,
            name: "Super Administrator",
            role: "Admin",
            passwordHash,
          },
        });
        const { passwordHash: _, ...user } = created as any;
        return NextResponse.json(user);
      }
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const ok = await verifyPassword(password, existing.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }
    const { passwordHash: _, ...user } = existing as any;
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: "Gagal login" }, { status: 500 });
  }
}

