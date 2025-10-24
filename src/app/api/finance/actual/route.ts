import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { FinanceCategory } from "@prisma/client";

type ActualEntryInput = {
  category: FinanceCategory;
  amount: number;
  data?: any;
};

type ActualRequestBody = {
  period: {
    id?: number;
    name: string;
    month: number;
    year: number;
    startDate: string;
    endDate: string;
  };
  entries: ActualEntryInput[];
};

function parseISODate(value: string, label: string): Date {
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`${label} is invalid date`);
  }
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodIdRaw = searchParams.get("periodId");
    const monthRaw = searchParams.get("month");
    const yearRaw = searchParams.get("year");

    logRouteStart("finance-actual-get", { periodIdRaw, monthRaw, yearRaw });

    if (!periodIdRaw && !(monthRaw && yearRaw)) {
      const periods = await withRetry(async () => {
        const rows = await prisma.financePeriod.findMany({
          orderBy: { startDate: "desc" },
          include: {
            actuals: {
              select: { amount: true },
            },
          },
        });
        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          month: row.month,
          year: row.year,
          totalActual: row.actuals.reduce((sum, entry) => sum + entry.amount, 0),
          startDate: row.startDate.toISOString(),
          endDate: row.endDate.toISOString(),
        }));
      }, 2, "finance-actual-list");

      logRouteComplete("finance-actual-get", periods.length);
      return NextResponse.json({ periods });
    }

    const period = await withRetry(async () => {
      if (periodIdRaw) {
        const id = Number(periodIdRaw);
        if (Number.isNaN(id)) throw new Error("periodId must be a number");
        return prisma.financePeriod.findUnique({
          where: { id },
          include: {
            actuals: { orderBy: { category: "asc" } },
          },
        });
      }
      const month = Number(monthRaw);
      const year = Number(yearRaw);
      if (Number.isNaN(month) || Number.isNaN(year)) {
        throw new Error("month and year must be numbers");
      }
      return prisma.financePeriod.findUnique({
        where: { month_year: { month, year } },
        include: {
          actuals: { orderBy: { category: "asc" } },
        },
      });
    }, 2, "finance-actual-get-period");

    if (!period) {
      logRouteComplete("finance-actual-get", 0);
      return NextResponse.json({ period: null }, { status: 404 });
    }

    const payload = {
      period: {
        id: period.id,
        name: period.name,
        month: period.month,
        year: period.year,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        createdAt: period.createdAt.toISOString(),
        updatedAt: period.updatedAt.toISOString(),
      },
      actualEntries: period.actuals.map((entry) => ({
        id: entry.id,
        category: entry.category,
        amount: entry.amount,
        data: entry.data,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    };

    logRouteComplete("finance-actual-get", payload.actualEntries.length);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch finance actual", error),
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ActualRequestBody;
    logRouteStart("finance-actual-post");

    if (!body?.period) {
      return NextResponse.json({ error: "period is required" }, { status: 400 });
    }
    if (!Array.isArray(body.entries)) {
      return NextResponse.json({ error: "entries must be an array" }, { status: 400 });
    }

    const { period: periodPayload, entries } = body;
    if (!periodPayload.name?.trim()) {
      return NextResponse.json({ error: "period.name is required" }, { status: 400 });
    }
    if (typeof periodPayload.month !== "number" || typeof periodPayload.year !== "number") {
      return NextResponse.json({ error: "period.month and period.year must be numbers" }, { status: 400 });
    }

    const startDate = parseISODate(periodPayload.startDate, "period.startDate");
    const endDate = parseISODate(periodPayload.endDate, "period.endDate");
    if (endDate < startDate) {
      return NextResponse.json({ error: "period.endDate must be after startDate" }, { status: 400 });
    }

    const sanitizedEntries: ActualEntryInput[] = entries.map((entry) => {
      if (!entry || typeof entry.category !== "string") {
        throw new Error("each entry must include category");
      }
      const amount = typeof entry.amount === "number" ? Math.round(entry.amount) : NaN;
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("entry.amount must be a non-negative number");
      }
      if (!Object.values(FinanceCategory).includes(entry.category)) {
        throw new Error(`Invalid category: ${entry.category}`);
      }
      return {
        category: entry.category,
        amount,
        data: entry.data ?? null,
      };
    });

    const result = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        let period;
        if (periodPayload.id) {
          period = await tx.financePeriod.update({
            where: { id: periodPayload.id },
            data: {
              name: periodPayload.name,
              month: periodPayload.month,
              year: periodPayload.year,
              startDate,
              endDate,
            },
          });
        } else {
          period = await tx.financePeriod.upsert({
            where: { month_year: { month: periodPayload.month, year: periodPayload.year } },
            update: {
              name: periodPayload.name,
              startDate,
              endDate,
            },
            create: {
              name: periodPayload.name,
              month: periodPayload.month,
              year: periodPayload.year,
              startDate,
              endDate,
            },
          });
        }

        await tx.financeActualEntry.deleteMany({
          where: { periodId: period.id },
        });

        if (sanitizedEntries.length > 0) {
          await tx.financeActualEntry.createMany({
            data: sanitizedEntries.map((entry) => ({
              periodId: period.id,
              category: entry.category,
              amount: entry.amount,
              data: entry.data ?? null,
            })),
          });
        }

        const createdEntries = await tx.financeActualEntry.findMany({
          where: { periodId: period.id },
          orderBy: { category: "asc" },
        });

        return {
          period,
          actualEntries: createdEntries,
        };
      });
    }, 2, "finance-actual-upsert");

    const payload = {
      period: {
        id: result.period.id,
        name: result.period.name,
        month: result.period.month,
        year: result.period.year,
        startDate: result.period.startDate.toISOString(),
        endDate: result.period.endDate.toISOString(),
        createdAt: result.period.createdAt.toISOString(),
        updatedAt: result.period.updatedAt.toISOString(),
      },
      actualEntries: result.actualEntries.map((entry) => ({
        id: entry.id,
        category: entry.category,
        amount: entry.amount,
        data: entry.data,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    };

    logRouteComplete("finance-actual-post", payload.actualEntries.length);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("save finance actual", error),
      { status: 500 },
    );
  }
}
