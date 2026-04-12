/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `created_at` on the `users` table. All the data in the column will be lost.
  - Added the required column `id` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `users` DROP PRIMARY KEY,
    DROP COLUMN `created_at`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- CreateTable
CREATE TABLE `timelines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL,
    `profileImage` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `keyword1` VARCHAR(191) NOT NULL,
    `keyword2` VARCHAR(191) NULL,
    `keyword3` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `isOn` BOOLEAN NOT NULL,
    `memberCnt` INTEGER NOT NULL,
    `likeCnt` INTEGER NOT NULL,
    `creatorName` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `timelines_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timeline_member` (
    `userId` INTEGER NOT NULL,
    `timelineId` INTEGER NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'FRIEND', 'MEMBER') NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `timelineId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `timelines` ADD CONSTRAINT `timelines_creatorName_fkey` FOREIGN KEY (`creatorName`) REFERENCES `users`(`nickname`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timeline_member` ADD CONSTRAINT `timeline_member_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timeline_member` ADD CONSTRAINT `timeline_member_timelineId_fkey` FOREIGN KEY (`timelineId`) REFERENCES `timelines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
