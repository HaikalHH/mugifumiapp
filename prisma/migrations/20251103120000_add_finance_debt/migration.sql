-- Create table for finance debt payments per period (week)
CREATE TABLE IF NOT EXISTS "FinanceDebtPayment" (
  "id" SERIAL PRIMARY KEY,
  "periodId" INTEGER NOT NULL,
  "term" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceDebtPayment_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "FinancePeriod"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Auto-update updatedAt
CREATE OR REPLACE FUNCTION finance_debt_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_debt_payment_set_updated_at ON "FinanceDebtPayment";
CREATE TRIGGER finance_debt_payment_set_updated_at
BEFORE UPDATE ON "FinanceDebtPayment"
FOR EACH ROW
EXECUTE FUNCTION finance_debt_payment_updated_at();

CREATE INDEX IF NOT EXISTS "FinanceDebtPayment_periodId_idx"
ON "FinanceDebtPayment" ("periodId");
