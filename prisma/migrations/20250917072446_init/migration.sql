-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` INTEGER NOT NULL,
    `hppPercent` DOUBLE NOT NULL,
    `hppValue` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BarcodeItem` (
    `id` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(191) NOT NULL,
    `size` ENUM('PCS', 'REGULAR', 'LARGE') NOT NULL,
    `location` ENUM('BANDUNG', 'JAKARTA') NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BarcodeItem_barcode_key`(`barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` VARCHAR(191) NOT NULL,
    `barcodeId` VARCHAR(191) NOT NULL,
    `type` ENUM('IN', 'MOVE', 'OUT', 'DELETE') NOT NULL,
    `fromLocation` ENUM('BANDUNG', 'JAKARTA') NULL,
    `toLocation` ENUM('BANDUNG', 'JAKARTA') NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sale` (
    `id` VARCHAR(191) NOT NULL,
    `outlet` ENUM('TOKOPEDIA', 'SHOPEE', 'WHATSAPP', 'CAFE', 'WHOLESALE', 'FREE') NOT NULL,
    `location` ENUM('BANDUNG', 'JAKARTA') NOT NULL,
    `customer` VARCHAR(191) NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `shipDate` DATETIME(3) NULL,
    `status` ENUM('ORDERED', 'SHIPPING', 'CANCEL', 'REFUND', 'DISPLAY', 'SOLD', 'WASTE') NOT NULL DEFAULT 'ORDERED',
    `estimatePayoutDate` DATETIME(3) NULL,
    `actualPayoutDate` DATETIME(3) NULL,
    `discountPercent` DOUBLE NULL,
    `actualReceived` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SaleItem` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `barcodeId` VARCHAR(191) NULL,
    `unitPrice` INTEGER NOT NULL,
    `discountPct` DOUBLE NULL,
    `finalPrice` INTEGER NOT NULL,
    `status` ENUM('ORDERED', 'SHIPPING', 'CANCEL', 'REFUND', 'DISPLAY', 'SOLD', 'WASTE') NOT NULL DEFAULT 'ORDERED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SaleItem_barcodeId_key`(`barcodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BarcodeItem` ADD CONSTRAINT `BarcodeItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_barcodeId_fkey` FOREIGN KEY (`barcodeId`) REFERENCES `BarcodeItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `Sale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SaleItem` ADD CONSTRAINT `SaleItem_barcodeId_fkey` FOREIGN KEY (`barcodeId`) REFERENCES `BarcodeItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
