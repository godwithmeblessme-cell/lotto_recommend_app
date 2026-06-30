CREATE TABLE `lotto_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weekId` varchar(16) NOT NULL,
	`round` int NOT NULL,
	`winNumbers` json NOT NULL,
	`bonusNumber` int NOT NULL,
	`published` boolean NOT NULL DEFAULT false,
	`publishedAt` bigint,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lotto_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `lotto_results_weekId_unique` UNIQUE(`weekId`),
	CONSTRAINT `lr_week_idx` UNIQUE(`weekId`)
);
