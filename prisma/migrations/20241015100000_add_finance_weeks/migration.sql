-- Create finance week master table
CREATE TABLE IF NOT EXISTS "FinanceWeek" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure updatedAt auto-updates
CREATE OR REPLACE FUNCTION finance_week_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_week_set_updated_at ON "FinanceWeek";
CREATE TRIGGER finance_week_set_updated_at
BEFORE UPDATE ON "FinanceWeek"
FOR EACH ROW
EXECUTE FUNCTION finance_week_updated_at();

-- Extend FinancePeriod with optional week relation
ALTER TABLE "FinancePeriod"
  ADD COLUMN IF NOT EXISTS "weekId" INTEGER;

ALTER TABLE "FinancePeriod"
  ADD CONSTRAINT "FinancePeriod_weekId_fkey"
  FOREIGN KEY ("weekId") REFERENCES "FinanceWeek" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "FinancePeriod_weekId_idx"
ON "FinancePeriod" ("weekId");

-- Allow multiple periods per month/year by dropping the unique index
DROP INDEX IF EXISTS "FinancePeriod_month_year_key";
