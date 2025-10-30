import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) return NextResponse.json({ error: "userId wajib" }, { status: 400 });
    const open = await prisma.attendance.findFirst({
      where: { userId, clockOutAt: null },
      orderBy: { clockInAt: "desc" },
    });
    return NextResponse.json({ open });
  } catch {
    return NextResponse.json({ error: "Gagal ambil attendance" }, { status: 500 });
  }
}
