-- CreateTable
CREATE TABLE `users` (
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `nickname` VARCHAR(100) NOT NULL,
    `funnel` VARCHAR(100) NOT NULL,
    `purpose` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
