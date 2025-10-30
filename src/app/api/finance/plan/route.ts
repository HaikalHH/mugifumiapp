import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withRetry, createErrorResponse, logRouteStart, logRouteComplete } from "../../../../lib/db-utils";
import { FinanceCategory } from "@prisma/client";

type PlanEntryInput = {
  category: FinanceCategory;
  amount: number;
  data?: any;
};

type PlanRequestBody = {
  period: {
    id?: number;
    weekId: number;
    name?: string;
  };
  entries: PlanEntryInput[];
};

function mapWeek(
  week: { id: number; name: string; month: number; year: number; startDate: Date; endDate: Date } | null,
) {
  if (!week) return null;
  return {
    id: week.id,
    name: week.name,
    month: week.month,
    year: week.year,
    startDate: week.startDate.toISOString(),
    endDate: week.endDate.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const periodIdRaw = searchParams.get("periodId");
    const weekIdRaw = searchParams.get("weekId");

    logRouteStart("finance-plan-get", { periodIdRaw, weekIdRaw });

    if (!periodIdRaw && !weekIdRaw) {
      // Return list of periods with aggregates
      const periods = await withRetry(async () => {
        const rows = await prisma.financePeriod.findMany({
          orderBy: { startDate: "desc" },
          include: {
            _count: {
              select: {
                plans: true,
                actuals: true,
              },
            },
            week: true,
            plans: {
              select: { amount: true },
            },
            actuals: {
              select: { amount: true },
            },
          },
        });
        return rows.map((row) => ({
          id: row.id,
          name: row.name || row.week?.name || `Periode ${row.id}`,
          month: row.week?.month ?? row.startDate.getMonth() + 1,
          year: row.week?.year ?? row.startDate.getFullYear(),
          startDate: (row.week?.startDate ?? row.startDate).toISOString(),
          endDate: (row.week?.endDate ?? row.endDate).toISOString(),
          weekId: row.weekId,
          week: mapWeek(row.week ?? null),
          totalPlan: row.plans.reduce((sum, p) => sum + p.amount, 0),
          totalActual: row.actuals.reduce((sum, a) => sum + a.amount, 0),
          planEntryCount: row._count.plans,
          actualEntryCount: row._count.actuals,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }));
      }, 2, "finance-plan-list");

      logRouteComplete("finance-plan-get", periods.length);
      return NextResponse.json({ periods });
    }

    const period = await withRetry(async () => {
      if (periodIdRaw) {
        const id = Number(periodIdRaw);
        if (Number.isNaN(id)) {
          throw new Error("periodId must be a number");
        }
        return prisma.financePeriod.findUnique({
          where: { id },
          include: {
            plans: { orderBy: { category: "asc" } },
            actuals: { orderBy: { category: "asc" } },
            week: true,
          },
        });
      }
      if (weekIdRaw) {
        const weekId = Number(weekIdRaw);
        if (Number.isNaN(weekId)) {
          throw new Error("weekId must be a number");
        }
        return prisma.financePeriod.findFirst({
          where: { weekId },
          orderBy: { updatedAt: "desc" },
          include: {
            plans: { orderBy: { category: "asc" } },
            actuals: { orderBy: { category: "asc" } },
            week: true,
          },
        });
      }
      return null;
    }, 2, "finance-plan-get-period");

    if (!period) {
      logRouteComplete("finance-plan-get", 0);
      return NextResponse.json({ period: null }, { status: 404 });
    }

    const periodWeek = period.week ?? null;
    const payload = {
      period: {
        id: period.id,
        name: period.name || periodWeek?.name || `Periode ${period.id}`,
        month: periodWeek?.month ?? period.startDate.getMonth() + 1,
        year: periodWeek?.year ?? period.startDate.getFullYear(),
        startDate: (periodWeek?.startDate ?? period.startDate).toISOString(),
        endDate: (periodWeek?.endDate ?? period.endDate).toISOString(),
        weekId: period.weekId ?? null,
        week: mapWeek(periodWeek),
        createdAt: period.createdAt.toISOString(),
        updatedAt: period.updatedAt.toISOString(),
      },
      planEntries: period.plans.map((entry) => ({
        id: entry.id,
        category: entry.category,
        amount: entry.amount,
        data: entry.data,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
      actualEntries: period.actuals.map((entry) => ({
        id: entry.id,
        category: entry.category,
        amount: entry.amount,
        data: entry.data,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    };

    logRouteComplete("finance-plan-get", payload.planEntries.length);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("fetch finance plan", error),
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlanRequestBody;
    logRouteStart("finance-plan-post");

    if (!body?.period) {
      return NextResponse.json({ error: "period is required" }, { status: 400 });
    }
    if (!Array.isArray(body.entries)) {
      return NextResponse.json({ error: "entries must be an array" }, { status: 400 });
    }

    const { period: periodPayload, entries } = body;
    if (typeof periodPayload.weekId !== "number" || Number.isNaN(periodPayload.weekId)) {
      return NextResponse.json({ error: "period.weekId must be provided" }, { status: 400 });
    }

    const week = await prisma.financeWeek.findUnique({
      where: { id: periodPayload.weekId },
    });
    if (!week) {
      return NextResponse.json({ error: "Finance week not found" }, { status: 404 });
    }

    const periodName = periodPayload.name?.trim() || week.name;
    if (!periodName) {
      return NextResponse.json({ error: "period.name is required" }, { status: 400 });
    }

    const sanitizedEntries: PlanEntryInput[] = entries.map((entry) => {
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

    const weekStart = new Date(week.startDate);
    const weekEnd = new Date(week.endDate);

    const result = await withRetry(async () => {
      return prisma.$transaction(async (tx) => {
        let periodRecord;
        if (periodPayload.id) {
          periodRecord = await tx.financePeriod.update({
            where: { id: periodPayload.id },
            data: {
              name: periodName,
              month: weekStart.getMonth() + 1,
              year: weekStart.getFullYear(),
              startDate: weekStart,
              endDate: weekEnd,
              weekId: week.id,
            },
          });
        } else {
          const existing = await tx.financePeriod.findFirst({
            where: { weekId: week.id },
            orderBy: { updatedAt: "desc" },
          });
          if (existing) {
            periodRecord = await tx.financePeriod.update({
              where: { id: existing.id },
              data: {
                name: periodName,
                month: weekStart.getMonth() + 1,
                year: weekStart.getFullYear(),
                startDate: weekStart,
                endDate: weekEnd,
                weekId: week.id,
              },
            });
          } else {
            periodRecord = await tx.financePeriod.create({
              data: {
                name: periodName,
                month: weekStart.getMonth() + 1,
                year: weekStart.getFullYear(),
                startDate: weekStart,
                endDate: weekEnd,
                weekId: week.id,
              },
            });
          }
        }

        await tx.financePlanEntry.deleteMany({
          where: { periodId: periodRecord.id },
        });

        if (sanitizedEntries.length > 0) {
          await tx.financePlanEntry.createMany({
            data: sanitizedEntries.map((entry) => ({
              periodId: periodRecord.id,
              category: entry.category,
              amount: entry.amount,
              data: entry.data ?? null,
            })),
          });
        }

        const createdEntries = await tx.financePlanEntry.findMany({
          where: { periodId: periodRecord.id },
          orderBy: { category: "asc" },
        });

        const periodWithRelations = await tx.financePeriod.findUnique({
          where: { id: periodRecord.id },
          include: { week: true },
        });

        return {
          period: periodWithRelations!,
          planEntries: createdEntries,
        };
      });
    }, 2, "finance-plan-upsert");

    const weekInfo = result.period.week ?? null;
    const payload = {
      period: {
        id: result.period.id,
        name: result.period.name || weekInfo?.name || `Periode ${result.period.id}`,
        month: weekInfo?.month ?? result.period.startDate.getMonth() + 1,
        year: weekInfo?.year ?? result.period.startDate.getFullYear(),
        startDate: (weekInfo?.startDate ?? result.period.startDate).toISOString(),
        endDate: (weekInfo?.endDate ?? result.period.endDate).toISOString(),
        weekId: result.period.weekId ?? null,
        week: mapWeek(weekInfo),
        createdAt: result.period.createdAt.toISOString(),
        updatedAt: result.period.updatedAt.toISOString(),
      },
      planEntries: result.planEntries.map((entry) => ({
        id: entry.id,
        category: entry.category,
        amount: entry.amount,
        data: entry.data,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
      })),
    };

    logRouteComplete("finance-plan-post", payload.planEntries.length);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("save finance plan", error),
      { status: 500 },
    );
  }
}
