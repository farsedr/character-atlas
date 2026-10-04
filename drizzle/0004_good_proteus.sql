CREATE TABLE `atlas_baidu_backups` (
	`asset_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`remote_path` text NOT NULL,
	`status` text NOT NULL,
	`upload_id` text DEFAULT '' NOT NULL,
	`block_list` text DEFAULT '[]' NOT NULL,
	`needed_parts` text DEFAULT '[]' NOT NULL,
	`next_part` integer DEFAULT 0 NOT NULL,
	`fs_id` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`lease_id` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_baidu_owner_queue` ON `atlas_baidu_backups` (`owner_id`,`connection_id`,`status`,`lease_until`);--> statement-breakpoint
CREATE TABLE `atlas_baidu_connections` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`baidu_uk` text NOT NULL,
	`display_name` text NOT NULL,
	`token_cipher` text NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`auto_backup` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_baidu_oauth` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
