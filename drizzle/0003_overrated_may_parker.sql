CREATE TABLE `attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`attendDate` varchar(10) NOT NULL,
	`streakCount` int NOT NULL DEFAULT 1,
	`combosGranted` int NOT NULL DEFAULT 1,
	`bonusType` enum('none','streak15','streak30') NOT NULL DEFAULT 'none',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`),
	CONSTRAINT `att_user_date_idx` UNIQUE(`userId`,`attendDate`)
);
--> statement-breakpoint
CREATE INDEX `att_user_idx` ON `attendance` (`userId`);