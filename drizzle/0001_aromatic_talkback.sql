CREATE TABLE `atlas_model_config` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`protocol` text NOT NULL,
	`base_url` text NOT NULL,
	`model` text NOT NULL,
	`key_cipher` text NOT NULL,
	`updated_at` text NOT NULL
);
