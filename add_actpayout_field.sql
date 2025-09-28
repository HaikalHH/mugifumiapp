-- Add actPayout field to Order table
-- Run this SQL in your database SQL editor

-- Step 1: Update existing 'pending' orders to 'confirmed' first
UPDATE "Order" SET "status" = 'confirmed' WHERE "status" = 'pending';

-- Step 2: Add actPayout column to Order table
ALTER TABLE "Order" ADD COLUMN "actPayout" INTEGER;

-- Step 3: Update default status to 'confirmed' instead of 'pending'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'confirmed';

-- Step 4: Update existing constraint to remove 'pending' status
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('confirmed', 'cancelled'));
