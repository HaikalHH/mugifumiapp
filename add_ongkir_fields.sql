-- Add Ongkir Plan and Ongkir Actual fields to Delivery table
ALTER TABLE "Delivery" ADD COLUMN "ongkirPlan" INTEGER;
ALTER TABLE "Delivery" ADD COLUMN "ongkirActual" INTEGER;

-- Add comments for clarity
COMMENT ON COLUMN "Delivery"."ongkirPlan" IS 'Ongkir (Plan) in Rupiah - planned delivery cost';
COMMENT ON COLUMN "Delivery"."ongkirActual" IS 'Ongkir (Actual) in Rupiah - actual delivery cost';
