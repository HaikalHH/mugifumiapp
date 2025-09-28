-- Rollback Migration: Remove Order and Delivery tables
-- Run this SQL in your database SQL editor to undo the changes

-- Drop tables in reverse order (due to foreign key constraints)
DROP TABLE IF EXISTS "DeliveryItem";
DROP TABLE IF EXISTS "Delivery";
DROP TABLE IF EXISTS "OrderItem";
DROP TABLE IF EXISTS "Order";

-- Note: This will permanently delete all data in these tables
-- Make sure to backup your data before running this rollback
