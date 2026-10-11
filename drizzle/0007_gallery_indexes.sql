CREATE INDEX IF NOT EXISTS atlas_owner_gallery ON atlas_assets(owner_id,deleted_at,created_at);
CREATE INDEX IF NOT EXISTS atlas_owner_content ON atlas_assets(owner_id,json_extract(body,'$.contentHash'));
CREATE INDEX IF NOT EXISTS atlas_owner_related ON atlas_assets(owner_id,json_extract(body,'$.relatedAssetIdentity'));
CREATE INDEX IF NOT EXISTS atlas_owner_upload_batch ON atlas_assets(owner_id,json_extract(body,'$.uploadBatch'));
