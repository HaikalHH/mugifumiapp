-- Rollback script for actPayout field migration
-- Run this SQL in your database SQL editor if you need to rollback

-- Step 1: Drop the new constraint
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_check";

-- Step 2: Restore the original constraint (allowing 'pending')
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" 
CHECK ("status" IN ('pending', 'confirmed', 'cancelled'));

-- Step 3: Restore default status to 'pending'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'pending';

-- Step 4: Remove actPayout column
ALTER TABLE "Order" DROP COLUMN IF EXISTS "actPayout";

-- Step 5: Verify rollback
SELECT 
    'Rollback completed successfully' as status,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN "status" = 'pending' THEN 1 END) as pending_orders,
    COUNT(CASE WHEN "status" = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN "status" = 'cancelled' THEN 1 END) as cancelled_orders
FROM "Order";
