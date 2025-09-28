# Error 500 Fix - Database Schema Issue

## Problem
Getting 500 errors when accessing order-related endpoints after adding new features.

## Root Cause
The error occurs because the database schema doesn't match the Prisma schema. Specifically:
- Field `actPayout` was added to Prisma schema but not to the actual database
- API endpoints are trying to access fields that don't exist in the database

## Immediate Fix Applied

### 1. Commented Out actPayout References
Temporarily commented out all references to `actPayout` field until database migration is run:

#### API Endpoints:
- `src/app/api/orders/route.ts` - Commented out actPayout in GET and POST handlers
- `src/app/api/orders/pending/route.ts` - No actPayout references (OK)

#### Frontend:
- `src/app/orders/page.tsx` - Commented out actPayout in form state and UI

### 2. Created Test Endpoints
- `src/app/api/test-simple/route.ts` - Test basic database connectivity
- `src/app/api/test-schema/route.ts` - Test schema with actPayout field

## Next Steps to Fully Fix

### Step 1: Run Database Migration
Execute the SQL migration in your database:

```sql
-- Add actPayout field to Order table
ALTER TABLE "Order" ADD COLUMN "actPayout" INTEGER;

-- Update default status to 'confirmed' instead of 'pending'
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'confirmed';

-- Update existing constraint to remove 'pending' status
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_status_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('confirmed', 'cancelled'));
```

### Step 2: Uncomment actPayout References
After running the migration, uncomment all the actPayout references:

#### In `src/app/api/orders/route.ts`:
```typescript
// Uncomment these lines:
actPayout: true,
actPayout?: number | null,
totalAmount: actPayout || totalAmount,
```

#### In `src/app/orders/page.tsx`:
```typescript
// Uncomment these lines:
actPayout: "",
actPayout: order.actPayout?.toString() || "",
actPayout: (outlet === "Tokopedia" || outlet === "Shopee") && form.actPayout ? Number(form.actPayout) : null,
```

#### Uncomment the payout fields UI section:
```typescript
// Uncomment the entire payout fields section
{(outlet === "Tokopedia" || outlet === "Shopee") && (
  // ... payout fields UI
)}
```

### Step 3: Test the Fix
1. Test basic connectivity: `GET /api/test-simple`
2. Test with actPayout: `GET /api/test-schema`
3. Test order creation and editing

## Current Status
- ✅ Basic functionality restored (no more 500 errors)
- ✅ Order creation, editing, and deletion work
- ✅ Delivery functionality works
- ⏳ Payout fields temporarily disabled until migration

## Files Modified for Temporary Fix
- `src/app/api/orders/route.ts` - Commented out actPayout references
- `src/app/orders/page.tsx` - Commented out actPayout references
- `src/app/api/test-simple/route.ts` - New test endpoint
- `src/app/api/test-schema/route.ts` - New test endpoint

## Verification Commands
```bash
# Test basic connectivity
curl http://localhost:3000/api/test-simple

# Test schema (will fail until migration is run)
curl http://localhost:3000/api/test-schema

# Test orders endpoint
curl http://localhost:3000/api/orders
```

## Notes
- The temporary fix maintains all core functionality
- Payout features are disabled but can be easily re-enabled after migration
- No data loss or breaking changes to existing functionality
- All other features (delivery, inventory, etc.) continue to work normally
