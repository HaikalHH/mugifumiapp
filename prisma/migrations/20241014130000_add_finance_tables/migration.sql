-- Create enum for finance categories
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinanceCategory') THEN
        CREATE TYPE "FinanceCategory" AS ENUM (
            'BAHAN',
            'PAYROLL',
            'BUILDING',
            'OPERASIONAL',
            'TRANSPORT',
            'PERLENGKAPAN',
            'MARKETING'
        );
    END IF;
END $$;

-- Create finance period table
CREATE TABLE IF NOT EXISTS "FinancePeriod" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure updatedAt auto-updates
CREATE OR REPLACE FUNCTION finance_period_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_period_set_updated_at ON "FinancePeriod";
CREATE TRIGGER finance_period_set_updated_at
BEFORE UPDATE ON "FinancePeriod"
FOR EACH ROW
EXECUTE FUNCTION finance_period_updated_at();

-- Unique month/year pairing
CREATE UNIQUE INDEX IF NOT EXISTS "FinancePeriod_month_year_key" ON "FinancePeriod" ("month", "year");

-- Create finance plan entries
CREATE TABLE IF NOT EXISTS "FinancePlanEntry" (
    "id" SERIAL PRIMARY KEY,
    "periodId" INTEGER NOT NULL,
    "category" "FinanceCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancePlanEntry_periodId_fkey"
        FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION finance_plan_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_plan_entry_set_updated_at ON "FinancePlanEntry";
CREATE TRIGGER finance_plan_entry_set_updated_at
BEFORE UPDATE ON "FinancePlanEntry"
FOR EACH ROW
EXECUTE FUNCTION finance_plan_entry_updated_at();

CREATE INDEX IF NOT EXISTS "FinancePlanEntry_periodId_category_idx"
ON "FinancePlanEntry" ("periodId", "category");

-- Create finance actual entries
CREATE TABLE IF NOT EXISTS "FinanceActualEntry" (
    "id" SERIAL PRIMARY KEY,
    "periodId" INTEGER NOT NULL,
    "category" "FinanceCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceActualEntry_periodId_fkey"
        FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION finance_actual_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_actual_entry_set_updated_at ON "FinanceActualEntry";
CREATE TRIGGER finance_actual_entry_set_updated_at
BEFORE UPDATE ON "FinanceActualEntry"
FOR EACH ROW
EXECUTE FUNCTION finance_actual_entry_updated_at();

CREATE INDEX IF NOT EXISTS "FinanceActualEntry_periodId_category_idx"
ON "FinanceActualEntry" ("periodId", "category");
