-- Create Ingredient master table
CREATE TABLE IF NOT EXISTS "Ingredient" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL, -- gram | liter
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create RecipeItem (per-kg requirement) table
CREATE TABLE IF NOT EXISTS "RecipeItem" (
  "id" SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL,
  "ingredientId" INTEGER NOT NULL,
  "amountPerKg" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecipeItem_product_ingredient_key" UNIQUE ("productId", "ingredientId")
);

CREATE INDEX IF NOT EXISTS "RecipeItem_productId_idx" ON "RecipeItem" ("productId");
CREATE INDEX IF NOT EXISTS "RecipeItem_ingredientId_idx" ON "RecipeItem" ("ingredientId");

-- Auto-update updatedAt columns via triggers (optional, keeps consistency)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingredient_set_updated_at ON "Ingredient";
CREATE TRIGGER ingredient_set_updated_at
BEFORE UPDATE ON "Ingredient"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS recipe_item_set_updated_at ON "RecipeItem";
CREATE TRIGGER recipe_item_set_updated_at
BEFORE UPDATE ON "RecipeItem"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

