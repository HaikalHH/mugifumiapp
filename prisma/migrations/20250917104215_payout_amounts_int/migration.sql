/*
  Warnings:

  - The `actPayout` column on the `Sale` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `estPayout` column on the `Sale` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE `Sale` DROP COLUMN `actPayout`,
    ADD COLUMN `actPayout` INTEGER NULL,
    DROP COLUMN `estPayout`,
    ADD COLUMN `estPayout` INTEGER NULL;
