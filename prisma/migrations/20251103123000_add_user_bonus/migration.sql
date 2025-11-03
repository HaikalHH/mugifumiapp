-- Create table for user bonuses by month
CREATE TABLE IF NOT EXISTS "UserBonus" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBonus_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Auto-update updatedAt
CREATE OR REPLACE FUNCTION user_bonus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_bonus_set_updated_at ON "UserBonus";
CREATE TRIGGER user_bonus_set_updated_at
BEFORE UPDATE ON "UserBonus"
FOR EACH ROW
EXECUTE FUNCTION user_bonus_updated_at();

CREATE INDEX IF NOT EXISTS "UserBonus_userId_year_month_idx"
ON "UserBonus" ("userId", "year", "month");
