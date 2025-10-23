-- Add actPayout field to Order table
-- Run this SQL in your database SQL editor

-- Step 1: Update existing orders to new payment statuses
UPDATE "Order" SET "status" = 'PAID' WHERE "status" IN ('pending', 'confirmed');
UPDATE "Order" SET "status" = 'NOT PAID' WHERE "status" = 'cancelled';

ALTER TABLE "Order" ADD COLUMN "actPayout" INTEGER;

-- Step 3: Update default status to 'PAID'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PAID';

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('PAID', 'NOT PAID'));
