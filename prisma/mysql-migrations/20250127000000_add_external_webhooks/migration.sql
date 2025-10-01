-- CreateTable
CREATE TABLE `ExternalWebhook` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `events` JSON NULL,
    `headers` JSON NULL,
    `authentication` JSON NULL,
    `retryConfig` JSON NULL,
    `filterConfig` JSON NULL,
    `timeout` INTEGER NOT NULL DEFAULT 30000,
    `description` VARCHAR(500) NULL,
    `lastExecutionAt` TIMESTAMP NULL,
    `lastExecutionStatus` VARCHAR(20) NULL,
    `lastExecutionError` TEXT NULL,
    `totalExecutions` INTEGER NOT NULL DEFAULT 0,
    `successfulExecutions` INTEGER NOT NULL DEFAULT 0,
    `failedExecutions` INTEGER NOT NULL DEFAULT 0,
    `createdAt` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE INDEX `ExternalWebhook_name_key`(`name`),
    INDEX `ExternalWebhook_enabled_idx`(`enabled`),
    INDEX `ExternalWebhook_lastExecutionAt_idx`(`lastExecutionAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;