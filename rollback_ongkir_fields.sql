-- Rollback Ongkir Plan and Ongkir Actual fields from Delivery table
ALTER TABLE "Delivery" DROP COLUMN IF EXISTS "ongkirPlan";
ALTER TABLE "Delivery" DROP COLUMN IF EXISTS "ongkirActual";



