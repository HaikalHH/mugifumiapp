-- Migration: Add Order and Delivery tables
-- Run this SQL in your database SQL editor

-- Create Order table
CREATE TABLE "Order" (
    "id" SERIAL PRIMARY KEY,
    "outlet" TEXT NOT NULL,
    "customer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "orderDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "discount" DOUBLE PRECISION,
    "totalAmount" INTEGER,
    "actPayout" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create OrderItem table
CREATE TABLE "OrderItem" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create Delivery table
CREATE TABLE "Delivery" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create DeliveryItem table
CREATE TABLE "DeliveryItem" (
    "id" SERIAL PRIMARY KEY,
    "deliveryId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "barcode" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes for better performance
CREATE INDEX "Order_outlet_idx" ON "Order"("outlet");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_orderDate_idx" ON "Order"("orderDate");
CREATE INDEX "Order_location_idx" ON "Order"("location");

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

CREATE INDEX "Delivery_orderId_idx" ON "Delivery"("orderId");
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");
CREATE INDEX "Delivery_deliveryDate_idx" ON "Delivery"("deliveryDate");

CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId");
CREATE INDEX "DeliveryItem_productId_idx" ON "DeliveryItem"("productId");
CREATE INDEX "DeliveryItem_barcode_idx" ON "DeliveryItem"("barcode");

-- Add unique constraints
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_productId_key" UNIQUE ("orderId", "productId");
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_barcode_key" UNIQUE ("deliveryId", "barcode");

-- Add check constraints
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('PAID', 'NOT PAID'));
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_status_check" CHECK ("status" IN ('pending', 'delivered'));
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_price_check" CHECK ("price" >= 0);
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_price_check" CHECK ("price" >= 0);

-- Comments for documentation
COMMENT ON TABLE "Order" IS 'Orders created by customers';
COMMENT ON TABLE "OrderItem" IS 'Items within each order';
COMMENT ON TABLE "Delivery" IS 'Delivery records for orders';
COMMENT ON TABLE "DeliveryItem" IS 'Items delivered with barcode tracking';

COMMENT ON COLUMN "Order"."status" IS 'Order status: PAID or NOT PAID';
COMMENT ON COLUMN "Order"."totalAmount" IS 'Total amount after discount in Rupiah';
COMMENT ON COLUMN "Delivery"."status" IS 'Delivery status: pending, delivered';
COMMENT ON COLUMN "DeliveryItem"."barcode" IS 'Scanned barcode from inventory';
