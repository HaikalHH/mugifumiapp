/*
  Warnings:

  - The primary key for the `Product` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `hppPercent` on the `Product` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - The primary key for the `Sale` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `actualPayoutDate` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `actualReceived` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `discountPercent` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `estimatePayoutDate` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Sale` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Sale` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `outlet` on the `Sale` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `VarChar(191)`.
  - You are about to alter the column `location` on the `Sale` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `VarChar(191)`.
  - You are about to alter the column `status` on the `Sale` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(7))` to `VarChar(191)`.
  - The primary key for the `SaleItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `barcodeId` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `discountPct` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `finalPrice` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `SaleItem` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `saleId` on the `SaleItem` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `productId` on the `SaleItem` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `status` on the `SaleItem` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(8))` to `VarChar(191)`.
  - You are about to drop the `BarcodeItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryMovement` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `hppPct` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `barcode` to the `SaleItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `SaleItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `BarcodeItem` DROP FOREIGN KEY `BarcodeItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `InventoryMovement` DROP FOREIGN KEY `InventoryMovement_barcodeId_fkey`;

-- DropForeignKey
ALTER TABLE `SaleItem` DROP FOREIGN KEY `SaleItem_barcodeId_fkey`;

-- DropForeignKey
ALTER TABLE `SaleItem` DROP FOREIGN KEY `SaleItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `SaleItem` DROP FOREIGN KEY `SaleItem_saleId_fkey`;

-- DropIndex
DROP INDEX `SaleItem_barcodeId_key` ON `SaleItem`;

-- DropIndex
DROP INDEX `SaleItem_productId_fkey` ON `SaleItem`;

-- DropIndex
DROP INDEX `SaleItem_saleId_fkey` ON `SaleItem`;

-- AlterTable
ALTER TABLE `Product` DROP PRIMARY KEY,
    DROP COLUMN `hppPercent`,
    ADD COLUMN `hppPct` DOUBLE NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Sale` DROP PRIMARY KEY,
    DROP COLUMN `actualPayoutDate`,
    DROP COLUMN `actualReceived`,
    DROP COLUMN `discountPercent`,
    DROP COLUMN `estimatePayoutDate`,
    DROP COLUMN `notes`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `actPayout` DATETIME(3) NULL,
    ADD COLUMN `discount` DOUBLE NULL,
    ADD COLUMN `estPayout` DATETIME(3) NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `outlet` VARCHAR(191) NOT NULL,
    MODIFY `location` VARCHAR(191) NOT NULL,
    ALTER COLUMN `orderDate` DROP DEFAULT,
    MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'ordered',
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `SaleItem` DROP PRIMARY KEY,
    DROP COLUMN `barcodeId`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `discountPct`,
    DROP COLUMN `finalPrice`,
    DROP COLUMN `unitPrice`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `barcode` VARCHAR(191) NOT NULL,
    ADD COLUMN `price` INTEGER NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `saleId` INTEGER NOT NULL,
    MODIFY `productId` INTEGER NOT NULL,
    MODIFY `status` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- DropTable
DROP TABLE `BarcodeItem`;

-- DropTable
DROP TABLE `InventoryMovement`;

-- CreateTable
CREATE TABLE `Inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `barcode` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `productId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Inventory_barcode_key`(`barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Inventory` ADD CONSTRAINT `Inventory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
