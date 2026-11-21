-- AlterTable
ALTER TABLE `comments` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `parentId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `comments_parentId_idx` ON `comments`(`parentId`);

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `comments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
