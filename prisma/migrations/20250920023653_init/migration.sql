-- CreateTable
CREATE TABLE "public"."Product" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "hppPct" DOUBLE PRECISION NOT NULL,
  "hppValue" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Inventory" (
  "id" SERIAL NOT NULL,
  "barcode" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'READY',
  CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sale" (
  "id" SERIAL NOT NULL,
  "outlet" TEXT NOT NULL,
  "customer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ordered',
  "orderDate" TIMESTAMP(3) NOT NULL,
  "shipDate" TIMESTAMP(3),
  "estPayout" INTEGER,
  "actPayout" INTEGER,
  "location" TEXT NOT NULL,
  "discount" DOUBLE PRECISION,
  "actualReceived" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SaleItem" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "productId" INTEGER NOT NULL,
  "barcode" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "status" TEXT,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "public"."Product" ("code");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_barcode_key" ON "public"."Inventory" ("barcode");

-- AddForeignKey
ALTER TABLE "public"."Inventory"
  ADD CONSTRAINT "Inventory_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "public"."Product" ("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem"
  ADD CONSTRAINT "SaleItem_saleId_fkey"
  FOREIGN KEY ("saleId")
  REFERENCES "public"."Sale" ("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem"
  ADD CONSTRAINT "SaleItem_productId_fkey"
  FOREIGN KEY ("productId")
  REFERENCES "public"."Product" ("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
