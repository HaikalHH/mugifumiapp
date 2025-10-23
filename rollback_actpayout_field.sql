-- Rollback script for actPayout field migration
-- Run this SQL in your database SQL editor if you need to rollback

-- Step 1: Drop the new constraint
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_check";

-- Step 2: Restore the payment status constraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" 
CHECK ("status" IN ('PAID', 'NOT PAID'));

-- Step 3: Restore default status to 'PAID'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PAID';

-- Step 4: Remove actPayout column
ALTER TABLE "Order" DROP COLUMN IF EXISTS "actPayout";

-- Step 5: Verify rollback
SELECT 
    'Rollback completed successfully' as status,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN "status" = 'PAID' THEN 1 END) as paid_orders,
    COUNT(CASE WHEN "status" = 'NOT PAID' THEN 1 END) as not_paid_orders
FROM "Order";
