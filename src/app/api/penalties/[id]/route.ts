import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { createErrorResponse, logRouteStart, logRouteComplete, withRetry } from "../../../../lib/db-utils";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    logRouteStart("penalties-delete");
    const { id } = await params;
    const pid = parseInt(id);
    if (isNaN(pid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await withRetry(async () => {
      await prisma.manualPenalty.delete({ where: { id: pid } });
    }, 2, "penalties-delete");

    logRouteComplete("penalties-delete");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(createErrorResponse("delete penalty", error), { status: 500 });
  }
}
