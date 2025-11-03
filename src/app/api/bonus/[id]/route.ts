import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function PUT(req: Request, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } };
    const id = Number(params?.id);
    const body = await req.json().catch(() => null) as { userId?: number; year?: number; month?: number; amount?: number; note?: string } | null;
    if (!id || !body) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
    const updated = await prisma.userBonus.update({
      where: { id },
      data: {
        userId: body.userId ? Number(body.userId) : undefined,
        year: body.year ? Number(body.year) : undefined,
        month: body.month ? Number(body.month) : undefined,
        amount: body.amount != null ? Math.round(Number(body.amount)) : undefined,
        note: body.note?.trim(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update bonus' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } };
    const id = Number(params?.id);
    if (!id) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
    await prisma.userBonus.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete bonus' }, { status: 500 });
  }
}
