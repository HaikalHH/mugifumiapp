-- Safe migration script for adding actPayout field
-- Run this SQL in your database SQL editor

-- Step 1: Check if actPayout column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' AND column_name = 'actPayout'
    ) THEN
        -- Add actPayout column to Order table
        ALTER TABLE "Order" ADD COLUMN "actPayout" INTEGER;
        RAISE NOTICE 'actPayout column added successfully';
    ELSE
        RAISE NOTICE 'actPayout column already exists, skipping...';
    END IF;
END $$;

-- Step 2: Check and update existing 'pending' orders
DO $$
DECLARE
    pending_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pending_count FROM "Order" WHERE "status" = 'pending';
    
    IF pending_count > 0 THEN
        UPDATE "Order" SET "status" = 'confirmed' WHERE "status" = 'pending';
        RAISE NOTICE 'Updated % pending orders to confirmed', pending_count;
    ELSE
        RAISE NOTICE 'No pending orders found';
    END IF;
END $$;

-- Step 3: Update default status to 'confirmed'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'confirmed';

-- Step 4: Update constraint safely
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Order_status_check' AND table_name = 'Order'
    ) THEN
        ALTER TABLE "Order" DROP CONSTRAINT "Order_status_check";
        RAISE NOTICE 'Dropped existing Order_status_check constraint';
    END IF;
    
    -- Add new constraint
    ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" 
    CHECK ("status" IN ('confirmed', 'cancelled'));
    RAISE NOTICE 'Added new Order_status_check constraint';
END $$;

-- Step 5: Verify the migration
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN "status" = 'confirmed' THEN 1 END) as confirmed_orders,
    COUNT(CASE WHEN "status" = 'cancelled' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN "actPayout" IS NOT NULL THEN 1 END) as orders_with_actpayout
FROM "Order";
