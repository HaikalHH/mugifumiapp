-- Create PlanProduct master table used by planning helper
CREATE TABLE IF NOT EXISTS "PlanProduct" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure updatedAt column stays fresh
DROP TRIGGER IF EXISTS plan_product_set_updated_at ON "PlanProduct";
CREATE TRIGGER plan_product_set_updated_at
BEFORE UPDATE ON "PlanProduct"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Populate PlanProduct with any product names that are already referenced by recipes
INSERT INTO "PlanProduct" ("id", "name", "createdAt", "updatedAt")
SELECT DISTINCT p."id", p."name", COALESCE(p."createdAt", CURRENT_TIMESTAMP), COALESCE(p."updatedAt", CURRENT_TIMESTAMP)
FROM "Product" p
WHERE EXISTS (
  SELECT 1 FROM "RecipeItem" ri WHERE ri."productId" = p."id"
)
ON CONFLICT ("id") DO NOTHING;

-- Point recipe items to the new PlanProduct table
ALTER TABLE "RecipeItem" DROP CONSTRAINT IF EXISTS "RecipeItem_productId_fkey";
ALTER TABLE "RecipeItem"
  ADD CONSTRAINT "RecipeItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "PlanProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Align PlanProduct sequence with current max id to avoid collisions after manual inserts
SELECT setval(
  pg_get_serial_sequence('"PlanProduct"', 'id'),
  GREATEST(COALESCE((SELECT MAX("id") FROM "PlanProduct"), 0) + 1, 1),
  false
);
