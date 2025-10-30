-- Add payroll/schedule fields to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "baseSalary" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "workStartMinutes" INTEGER NOT NULL DEFAULT 540,
  ADD COLUMN IF NOT EXISTS "workEndMinutes" INTEGER NOT NULL DEFAULT 1020,
  ADD COLUMN IF NOT EXISTS "overtimeHourlyRate" INTEGER;

-- Attendance table
CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "clockInAt" TIMESTAMP(3) NOT NULL,
  "clockOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attendance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_set_updated_at ON "Attendance";
CREATE TRIGGER attendance_set_updated_at
BEFORE UPDATE ON "Attendance"
FOR EACH ROW
EXECUTE FUNCTION attendance_updated_at();

CREATE INDEX IF NOT EXISTS "Attendance_userId_date_idx" ON "Attendance" ("userId", "date");

-- OvertimeRequest table
CREATE TABLE IF NOT EXISTS "OvertimeRequest" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedById" INTEGER,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OvertimeRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE OR REPLACE FUNCTION overtime_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS overtime_set_updated_at ON "OvertimeRequest";
CREATE TRIGGER overtime_set_updated_at
BEFORE UPDATE ON "OvertimeRequest"
FOR EACH ROW
EXECUTE FUNCTION overtime_updated_at();

CREATE INDEX IF NOT EXISTS "OvertimeRequest_userId_startAt_idx" ON "OvertimeRequest" ("userId", "startAt");

