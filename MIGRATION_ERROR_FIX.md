# Migration Error Fix - Constraint Violation

## Problem
When running the migration script, getting this error:
```
ERROR: 23514: check constraint "Order_status_check" of relation "Order" is violated by some row
```

## Root Cause
The error occurs because:
1. There are existing orders in the database with status "pending"
2. The new constraint only allows "confirmed" and "cancelled" statuses
3. The migration tries to add the constraint before updating existing data

## Solution

### Option 1: Use the Updated Migration Script
The original `add_actpayout_field.sql` has been updated to handle this:

```sql
-- Step 1: Update existing 'pending' orders to 'confirmed' first
UPDATE "Order" SET "status" = 'confirmed' WHERE "status" = 'pending';

-- Step 2: Add actPayout column to Order table
ALTER TABLE "Order" ADD COLUMN "actPayout" INTEGER;

-- Step 3: Update default status to 'confirmed' instead of 'pending'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'confirmed';

-- Step 4: Update existing constraint to remove 'pending' status
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('confirmed', 'cancelled'));
```

### Option 2: Use the Safe Migration Script (Recommended)
Use `add_actpayout_field_safe.sql` which includes:
- ✅ Checks if column already exists
- ✅ Counts and updates pending orders
- ✅ Safe constraint handling
- ✅ Verification queries

```sql
-- Safe migration with checks and notifications
DO $$
BEGIN
    -- Check and update pending orders
    -- Add column if not exists
    -- Update constraints safely
    -- Provide feedback
END $$;
```

## Migration Steps

### Step 1: Check Current Data
Before running migration, check what data exists:
```sql
SELECT 
    "status",
    COUNT(*) as count
FROM "Order" 
GROUP BY "status";
```

### Step 2: Run Safe Migration
Execute `add_actpayout_field_safe.sql` in your database SQL editor.

### Step 3: Verify Migration
The safe script will show:
- How many pending orders were updated
- Migration completion status
- Final data summary

### Step 4: Update Application Code
After successful migration, uncomment all `actPayout` references in:
- `src/app/api/orders/route.ts`
- `src/app/api/orders/[id]/route.ts`
- `src/app/orders/page.tsx`

### Step 5: Regenerate Prisma Client
```bash
npx prisma generate
```

### Step 6: Restart Development Server
```bash
npm run dev
```

## Rollback Option
If you need to rollback, use `rollback_actpayout_field.sql`:
- Restores original constraint (allowing 'pending')
- Removes actPayout column
- Restores original default status

## Files Created

### Migration Scripts:
- ✅ `add_actpayout_field.sql` - Updated with proper order
- ✅ `add_actpayout_field_safe.sql` - Safe migration with checks
- ✅ `rollback_actpayout_field.sql` - Rollback script

### Documentation:
- ✅ `MIGRATION_ERROR_FIX.md` - This troubleshooting guide

## Expected Results After Migration

### Database Changes:
- ✅ `actPayout` column added to Order table
- ✅ All existing 'pending' orders become 'confirmed'
- ✅ New constraint allows only 'confirmed' and 'cancelled'
- ✅ Default status is 'confirmed'

### Application Changes:
- ✅ Payout fields visible for Tokopedia/Shopee orders
- ✅ Actual payout calculation works
- ✅ Payout percentage display works
- ✅ All existing functionality preserved

## Troubleshooting

### If Migration Still Fails:
1. Check for other status values not mentioned
2. Run the verification query first
3. Update any unexpected status values manually
4. Use the safe migration script

### If You Need to Keep 'pending' Status:
Modify the constraint to include 'pending':
```sql
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" 
CHECK ("status" IN ('pending', 'confirmed', 'cancelled'));
```

## Notes
- The migration is designed to be safe and reversible
- All existing data is preserved
- No data loss occurs during migration
- The safe script provides detailed feedback
- Rollback is available if needed
