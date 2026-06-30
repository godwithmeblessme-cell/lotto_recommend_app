CREATE TABLE `allocated_combos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekId` varchar(16) NOT NULL,
	`userId` int NOT NULL,
	`combo` json NOT NULL,
	`comboKey` varchar(32) NOT NULL,
	`kind` enum('subscription','free') NOT NULL DEFAULT 'subscription',
	`cycleNum` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `allocated_combos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `allocation_cursor` (
	`weekId` varchar(16) NOT NULL,
	`nextIndex` int NOT NULL DEFAULT 0,
	`cycleNum` int NOT NULL DEFAULT 1,
	`order` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `allocation_cursor_weekId` PRIMARY KEY(`weekId`)
);
--> statement-breakpoint
CREATE TABLE `daily_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`claimDate` varchar(10) NOT NULL,
	`claimType` enum('combo','points') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `dc_user_date_idx` UNIQUE(`userId`,`claimDate`)
);
--> statement-breakpoint
CREATE TABLE `points_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`delta` int NOT NULL,
	`reason` varchar(32) NOT NULL,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `points_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `push_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` varchar(16) NOT NULL DEFAULT 'toss',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` varchar(32) NOT NULL,
	`isDouble` boolean NOT NULL DEFAULT false,
	`startAt` bigint NOT NULL,
	`endAt` bigint,
	`status` enum('active','expired','cancelled') NOT NULL DEFAULT 'active',
	`source` varchar(16) NOT NULL DEFAULT 'tosspay',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_picks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekId` varchar(16) NOT NULL,
	`numbers` json NOT NULL,
	`poolComboCount` int NOT NULL DEFAULT 0,
	`combos` json NOT NULL,
	`published` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_picks_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_picks_weekId_unique` UNIQUE(`weekId`),
	CONSTRAINT `wp_week_idx` UNIQUE(`weekId`)
);
--> statement-breakpoint
CREATE INDEX `ac_week_user_idx` ON `allocated_combos` (`weekId`,`userId`);--> statement-breakpoint
CREATE INDEX `ac_week_key_idx` ON `allocated_combos` (`weekId`,`comboKey`);--> statement-breakpoint
CREATE INDEX `pl_user_idx` ON `points_ledger` (`userId`);--> statement-breakpoint
CREATE INDEX `pt_user_idx` ON `push_tokens` (`userId`);--> statement-breakpoint
CREATE INDEX `subs_user_idx` ON `subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `subs_status_idx` ON `subscriptions` (`status`);