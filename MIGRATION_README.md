# Database Migration: Add Order and Delivery Tables

## Overview
This migration adds new tables to support the Order and Delivery functionality:
- `Order` - Stores customer orders
- `OrderItem` - Stores items within each order
- `Delivery` - Stores delivery records
- `DeliveryItem` - Stores delivered items with barcode tracking

## Files
- `migration_add_order_delivery.sql` - Main migration script
- `rollback_order_delivery.sql` - Rollback script (if needed)

## How to Run Migration

### ⚠️ IMPORTANT: Run Migration First!
**You MUST run the database migration before using the new Order and Delivery features!**

### Option 1: Using Supabase SQL Editor (Recommended)
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `migration_add_order_delivery.sql`
4. Click **"Run"** to execute the migration
5. Verify success by running `check_tables.sql`

### Option 2: Using psql command line
```bash
psql -h your-db-host -U your-username -d your-database -f migration_add_order_delivery.sql
```

### Option 3: Using any PostgreSQL client
- Open your preferred PostgreSQL client (pgAdmin, DBeaver, etc.)
- Connect to your database
- Execute the SQL from `migration_add_order_delivery.sql`

## What the Migration Does

### Creates Tables:
1. **Order** - Main order table with customer info, outlet, status, etc.
2. **OrderItem** - Items in each order with quantity and price
3. **Delivery** - Delivery records linked to orders
4. **DeliveryItem** - Individual items delivered with barcode tracking

### Adds Constraints:
- Foreign key relationships between tables
- Check constraints for valid status values
- Unique constraints to prevent duplicates
- Not null constraints for required fields

### Creates Indexes:
- Performance indexes on frequently queried columns
- Composite indexes for common query patterns

## Rollback (If Needed)
If you need to undo the migration:
1. Run the SQL from `rollback_order_delivery.sql`
2. **Warning**: This will permanently delete all data in the new tables

## Verification
After running the migration, verify it worked by running:
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Order', 'OrderItem', 'Delivery', 'DeliveryItem');

-- Check table structure
\d "Order"
\d "OrderItem"
\d "Delivery"
\d "DeliveryItem"
```

## Notes
- The migration is designed to be safe and non-destructive
- It only adds new tables, doesn't modify existing ones
- All foreign key constraints are properly set up
- Indexes are created for optimal performance
- The migration follows PostgreSQL best practices
