CREATE TABLE IF NOT EXISTS atlas_backup_imports (
  owner_id TEXT NOT NULL,
  batch TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'receiving' CHECK (state IN ('receiving','cancelling','cancelled','completed')),
  imported INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(owner_id, batch)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS atlas_owner_backup_stage ON atlas_assets(owner_id,json_extract(body,'$.backupPending'),id) WHERE deleted_at='backup-pending';
--> statement-breakpoint
INSERT OR IGNORE INTO atlas_backup_imports(owner_id,batch,updated_at)
SELECT owner_id,json_extract(body,'$.backupPending'),0
FROM atlas_assets WHERE deleted_at='backup-pending' AND json_extract(body,'$.backupPending') IS NOT NULL AND owner_id IS NOT NULL
GROUP BY owner_id,json_extract(body,'$.backupPending');
