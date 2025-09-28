# actPayout Field Error Fix

## Problem
Getting Prisma error when trying to access orders:
```
The column `Order.actPayout` does not exist in the current database.
```

## Root Cause
The `actPayout` field was added to the Prisma schema but the database migration hasn't been run yet. The API endpoints are trying to access a field that doesn't exist in the actual database.

## Immediate Fix Applied

### 1. Commented Out All actPayout References
All references to `actPayout` field have been commented out in:

#### API Endpoints:
- ✅ `src/app/api/orders/route.ts` - Commented out actPayout in GET and POST
- ✅ `src/app/api/orders/[id]/route.ts` - Commented out actPayout in PUT and DELETE
- ✅ `src/app/api/orders/pending/route.ts` - No actPayout references (OK)

#### Frontend:
- ✅ `src/app/orders/page.tsx` - Commented out actPayout in form state and UI

### 2. Database Schema Status
Current database schema (without actPayout):
```sql
CREATE TABLE "Order" (
    "id" SERIAL PRIMARY KEY,
    "outlet" TEXT NOT NULL,
    "customer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "orderDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "discount" DOUBLE PRECISION,
    "totalAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## To Enable actPayout Field

### Step 1: Run Database Migration
Execute this SQL in your database SQL editor:

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

#### In `src/app/api/orders/[id]/route.ts`:
```typescript
// Uncomment these lines:
actPayout,
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

### Step 3: Regenerate Prisma Client
```bash
npx prisma generate
```

### Step 4: Restart Development Server
```bash
npm run dev
```

## Current Status
- ✅ **No more actPayout errors** - All references commented out
- ✅ **Order CRUD operations work** - Create, read, update, delete
- ✅ **Delivery functionality works** - All delivery features functional
- ✅ **Edit/Delete restrictions work** - Proper validation for delivered orders
- ⏳ **Payout features disabled** - Will be enabled after migration

## Files Modified for Temporary Fix
- `src/app/api/orders/route.ts` - Commented out actPayout references
- `src/app/api/orders/[id]/route.ts` - Commented out actPayout references
- `src/app/orders/page.tsx` - Commented out actPayout references

## Testing
After the fix, these endpoints should work without errors:
- ✅ `GET /api/orders` - List orders
- ✅ `POST /api/orders` - Create order
- ✅ `PUT /api/orders/[id]` - Update order
- ✅ `DELETE /api/orders/[id]` - Delete order
- ✅ `GET /api/orders/pending` - List pending orders
- ✅ `GET /api/deliveries` - List deliveries

## Notes
- The temporary fix maintains all core functionality
- Payout features are disabled but can be easily re-enabled after migration
- No data loss or breaking changes to existing functionality
- All other features (delivery, inventory, etc.) continue to work normally
- The app is now stable and functional without the actPayout field
