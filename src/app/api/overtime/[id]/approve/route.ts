import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    const { approve, adminId } = await req.json();
    if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
    const status = approve ? "APPROVED" : "REJECTED";
    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: { status, approvedById: adminId ?? null, approvedAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Gagal update lembur" }, { status: 500 });
  }
}
