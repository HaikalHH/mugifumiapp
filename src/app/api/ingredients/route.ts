import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../lib/db-utils";

export async function GET() {
  try {
    logRouteStart('ingredients-list');

    const items = await withRetry(async () => {
      return prisma.ingredient.findMany({
        select: { id: true, code: true, name: true, unit: true, createdAt: true, updatedAt: true },
        orderBy: { id: 'desc' }
      });
    }, 2, 'ingredients-list');

    logRouteComplete('ingredients-list', items.length);
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json(createErrorResponse("fetch ingredients", error), { status: 500 });
  }
}

function generateCodeFromName(name: string) {
  const base = name
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12);
  return base || 'ING';
}

async function ensureUniqueCode(base: string) {
  let code = base;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await prisma.ingredient.findUnique({ where: { code } });
    if (!exists) return code;
    code = `${base}-${String(suffix).padStart(2, '0')}`;
    suffix += 1;
  }
}

export async function POST(req: NextRequest) {
  try {
    logRouteStart('ingredients-create');
    const body = await req.json();
    const { code, name, unit } = body as { code?: string; name: string; unit: string };
    if (!name || !unit) {
      return NextResponse.json({ error: "name, unit are required" }, { status: 400 });
    }

    const finalCode = await withRetry(async () => {
      const base = (code?.trim() ? code.toUpperCase() : generateCodeFromName(name));
      return ensureUniqueCode(base);
    }, 1, 'ingredients-generate-code');

    const created = await withRetry(async () => {
      return prisma.ingredient.create({
        data: { code: finalCode, name, unit },
        select: { id: true, code: true, name: true, unit: true, createdAt: true, updatedAt: true }
      });
    }, 2, 'ingredients-create');

    logRouteComplete('ingredients-create', 1);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ingredient code already exists' }, { status: 409 });
    }
    return NextResponse.json(createErrorResponse("create ingredient", error), { status: 500 });
  }
}
