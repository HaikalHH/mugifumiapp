import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { hashPassword } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const { username, newPassword } = await req.json();
    if (!username || !newPassword) {
      return NextResponse.json({ error: "Username dan password baru wajib diisi" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return NextResponse.json({ message: "Password berhasil diubah" });
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengubah password" }, { status: 500 });
  }
}

