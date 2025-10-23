-- Update Order status values to PAID / NOT PAID and adjust defaults/constraints
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'Order'
          AND constraint_name = 'Order_status_check'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        EXECUTE 'ALTER TABLE \"Order\" DROP CONSTRAINT \"Order_status_check\"';
    END IF;
END $$;

-- Normalize existing statuses
UPDATE \"Order\"
SET \"status\" = 'PAID'
WHERE \"status\" IN ('confirmed', 'CONFIRMED', 'completed', 'COMPLETED');

UPDATE \"Order\"
SET \"status\" = 'NOT PAID'
WHERE \"status\" IN ('cancelled', 'CANCELLED', 'pending', 'PENDING', 'not paid', 'NOT_PAID');

-- Set new default and constraint
ALTER TABLE \"Order\"
ALTER COLUMN \"status\" SET DEFAULT 'PAID';

ALTER TABLE \"Order\"
ADD CONSTRAINT \"Order_status_check\" CHECK (\"status\" IN ('PAID', 'NOT PAID'));

COMMENT ON COLUMN \"Order\".\"status\" IS 'Order payment status: PAID or NOT PAID';
