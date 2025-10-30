import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { getStartOfDayJakarta, getEndOfDayJakarta } from "../../../../lib/timezone";

type WeekInput = {
  name: string;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
};

function parseISODate(value: string | undefined, label: string): Date {
  if (!value?.trim()) {
    throw new Error(`${label} is required`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid`);
  }
  return parsed;
}

function serializeWeek(week: {
  id: number;
  name: string;
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: week.id,
    name: week.name,
    month: week.month,
    year: week.year,
    startDate: week.startDate.toISOString(),
    endDate: week.endDate.toISOString(),
    createdAt: week.createdAt.toISOString(),
    updatedAt: week.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    logRouteStart("finance-weeks-get");

    const weeks = await withRetry(async () => {
      const rows = await prisma.financeWeek.findMany({
        orderBy: { startDate: "desc" },
      });
      return rows.map(serializeWeek);
    }, 2, "finance-weeks-list");

    logRouteComplete("finance-weeks-get", weeks.length);
    return NextResponse.json({ weeks });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch finance weeks", error),
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WeekInput;
    logRouteStart("finance-weeks-post");

    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (typeof body.month !== "number" || Number.isNaN(body.month) || body.month < 1 || body.month > 12) {
      return NextResponse.json({ error: "month must be between 1 and 12" }, { status: 400 });
    }
    if (typeof body.year !== "number" || Number.isNaN(body.year) || body.year < 2000) {
      return NextResponse.json({ error: "year must be a valid number" }, { status: 400 });
    }

    let startDate: Date;
    let endDate: Date;
    try {
      // Parse the dates and convert to Jakarta timezone
      const parsedStartDate = parseISODate(body.startDate, "startDate");
      const parsedEndDate = parseISODate(body.endDate, "endDate");
      
      // Convert to Jakarta timezone (start of day and end of day)
      startDate = getStartOfDayJakarta(parsedStartDate);
      endDate = getEndOfDayJakarta(parsedEndDate);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    if (endDate < startDate) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }

    const name = body.name.trim();

    const existing = await prisma.financeWeek.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json({ error: "Week name already exists" }, { status: 409 });
    }

    const created = await withRetry(async () => {
      return prisma.financeWeek.create({
        data: {
          name,
          month: body.month,
          year: body.year,
          startDate,
          endDate,
        },
      });
    }, 2, "finance-weeks-create");

    logRouteComplete("finance-weeks-post", created.id);
    return NextResponse.json({ week: serializeWeek(created) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("create finance week", error),
      { status: 500 },
    );
  }
}
