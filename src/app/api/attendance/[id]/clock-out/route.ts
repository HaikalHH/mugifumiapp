import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
    const now = new Date();
    const updated = await prisma.attendance.update({
      where: { id },
      data: { clockOutAt: now },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Gagal clock out" }, { status: 500 });
  }
}
