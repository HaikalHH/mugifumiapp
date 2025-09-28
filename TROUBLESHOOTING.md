# Troubleshooting Guide

## Error: "Cannot read properties of undefined (reading 'findMany')"

### Problem
You're getting errors like:
```
TypeError: Cannot read properties of undefined (reading 'findMany')
at prisma.order.findMany
at prisma.delivery.findMany
```

### Root Cause
This error occurs because the database tables `Order`, `OrderItem`, `Delivery`, and `DeliveryItem` don't exist yet in your database.

### Solution

#### Step 1: Run Database Migration
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste the contents of `migration_add_order_delivery.sql`
4. Click **"Run"** to execute the migration

#### Step 2: Verify Migration Success
Run this SQL to check if tables were created:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Order', 'OrderItem', 'Delivery', 'DeliveryItem');
```

You should see all 4 tables listed.

#### Step 3: Regenerate Prisma Client
After running the migration, regenerate the Prisma client:
```bash
npx prisma generate
```

#### Step 4: Restart Development Server
Restart your Next.js development server:
```bash
npm run dev
```

### Alternative: Check Migration Status
Run the `check_tables.sql` file in your SQL editor to see detailed information about the tables and their structure.

## Error: "Table 'Order' doesn't exist"

### Problem
Database error indicating the Order table doesn't exist.

### Solution
1. Make sure you've run the migration SQL script
2. Check if you're connected to the correct database
3. Verify the migration completed without errors

## Error: "Foreign key constraint fails"

### Problem
Error when trying to create orders or deliveries due to foreign key constraints.

### Solution
1. Make sure the `Product` table exists and has data
2. Verify that you're using valid product IDs when creating orders
3. Check that all foreign key relationships are properly set up

## Error: "Permission denied"

### Problem
Database permission errors when running migration.

### Solution
1. Make sure you're using a database user with CREATE TABLE permissions
2. In Supabase, use the service role key or ensure your user has proper permissions
3. Check your database connection settings

## Still Having Issues?

### Debug Steps:
1. **Check Database Connection**: Verify your `DATABASE_URL` is correct
2. **Check Prisma Schema**: Make sure `prisma/schema.prisma` includes the new models
3. **Check Migration**: Run `check_tables.sql` to verify tables exist
4. **Check Prisma Client**: Run `npx prisma generate` to regenerate client
5. **Check Server Logs**: Look for any additional error messages in the console

### Common Issues:
- **Wrong Database**: Make sure you're connected to the right database
- **Migration Not Run**: The most common issue - make sure to run the migration SQL
- **Prisma Client Outdated**: Regenerate with `npx prisma generate`
- **Server Not Restarted**: Restart your development server after changes

### Getting Help:
If you're still having issues, check:
1. Supabase logs in your project dashboard
2. Next.js console output for additional error details
3. Database connection status in Supabase
