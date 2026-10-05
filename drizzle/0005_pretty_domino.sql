ALTER TABLE `atlas_baidu_backups` ADD `task_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `atlas_baidu_backups` ADD `task_created_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE atlas_baidu_backups SET task_id=COALESCE((SELECT json_extract(body,'$.uploadBatch') FROM atlas_assets WHERE id=atlas_baidu_backups.asset_id),''),task_created_at=COALESCE((SELECT created_at FROM atlas_assets WHERE id=atlas_baidu_backups.asset_id),updated_at);
