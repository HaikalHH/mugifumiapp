import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { hashPassword } from "../../../lib/auth";

const DEFAULT_PASSWORD = "Otsuka2026";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        baseSalary: true,
        workStartMinutes: true,
        workEndMinutes: true,
      },
      orderBy: { id: "asc" },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil data user" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, username, role } = await req.json();
    if (!name || !username || !role) {
      return NextResponse.json({ error: "Nama, username, dan role wajib diisi" }, { status: 400 });
    }
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });
    }
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);
    const user = await prisma.user.create({
      data: { name, username, role, passwordHash },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Gagal membuat user" }, { status: 500 });
  }
}
