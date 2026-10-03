CREATE TABLE `atlas_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`original_key` text NOT NULL,
	`preview_key` text NOT NULL,
	`mime` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `atlas_labels` (
	`key` text PRIMARY KEY NOT NULL,
	`dimension` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
