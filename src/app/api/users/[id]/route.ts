import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    const u = await prisma.user.findUnique({ where: { id }, select: { baseSalary: true, workStartMinutes: true, workEndMinutes: true, overtimeHourlyRate: true } });
    return NextResponse.json(u || {});
  } catch (error) {
    return NextResponse.json({ error: "Gagal ambil user" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = Number(idStr);
    const body = await req.json();
    const data: any = {};
    if (typeof body.baseSalary === "number") data.baseSalary = body.baseSalary;
    if (typeof body.workStartMinutes === "number") data.workStartMinutes = body.workStartMinutes;
    if (typeof body.workEndMinutes === "number") data.workEndMinutes = body.workEndMinutes;
    if (typeof body.overtimeHourlyRate === "number" || body.overtimeHourlyRate === null) data.overtimeHourlyRate = body.overtimeHourlyRate;
    const u = await prisma.user.update({ where: { id }, data });
    return NextResponse.json({ ok: true, id: u.id });
  } catch (error) {
    return NextResponse.json({ error: "Gagal update user" }, { status: 500 });
  }
}
