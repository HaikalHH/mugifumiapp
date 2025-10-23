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

-- Step 2: Normalize existing statuses to PAID / NOT PAID
DO $$
DECLARE
    to_paid_count INTEGER;
    to_not_paid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO to_paid_count FROM "Order" WHERE "status" IN ('pending', 'confirmed');
    IF to_paid_count > 0 THEN
        UPDATE "Order" SET "status" = 'PAID' WHERE "status" IN ('pending', 'confirmed');
        RAISE NOTICE 'Updated % orders to PAID status', to_paid_count;
    ELSE
        RAISE NOTICE 'No orders required PAID normalization';
    END IF;

    SELECT COUNT(*) INTO to_not_paid_count FROM "Order" WHERE "status" = 'cancelled';
    IF to_not_paid_count > 0 THEN
        UPDATE "Order" SET "status" = 'NOT PAID' WHERE "status" = 'cancelled';
        RAISE NOTICE 'Updated % orders to NOT PAID status', to_not_paid_count;
    ELSE
        RAISE NOTICE 'No orders required NOT PAID normalization';
    END IF;
END $$;

-- Step 3: Update default status to 'PAID'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PAID';

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
    CHECK ("status" IN ('PAID', 'NOT PAID'));
    RAISE NOTICE 'Added new Order_status_check constraint';
END $$;

-- Step 5: Verify the migration
SELECT 
    'Migration completed successfully' as status,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN "status" = 'PAID' THEN 1 END) as paid_orders,
    COUNT(CASE WHEN "status" = 'NOT PAID' THEN 1 END) as not_paid_orders,
    COUNT(CASE WHEN "actPayout" IS NOT NULL THEN 1 END) as orders_with_actpayout
FROM "Order";
