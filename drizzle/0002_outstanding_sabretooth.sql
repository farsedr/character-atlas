CREATE TABLE `atlas_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_projects_name_key_unique` ON `atlas_projects` (`name_key`);--> statement-breakpoint
CREATE TABLE `atlas_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` integer NOT NULL,
	`agent` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_users_email_unique` ON `atlas_users` (`email`);--> statement-breakpoint
ALTER TABLE `atlas_assets` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `atlas_assets` ADD `display_number` integer;--> statement-breakpoint
ALTER TABLE `atlas_assets` ADD `deleted_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_owner_number` ON `atlas_assets` (`owner_id`,`display_number`) WHERE deleted_at IS NULL;--> statement-breakpoint
ALTER TABLE `atlas_labels` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `atlas_labels` ADD `group_name` text DEFAULT '新增标签' NOT NULL;