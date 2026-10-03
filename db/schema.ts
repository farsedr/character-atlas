import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const labels = sqliteTable("atlas_labels", {
 key: text("key").primaryKey(), dimension: text("dimension").notNull(), name: text("name").notNull(),
 source: text("source").notNull(), createdAt: text("created_at").notNull()
});
export const assets = sqliteTable("atlas_assets", {
 id: text("id").primaryKey(), body: text("body").notNull(),
 originalKey: text("original_key").notNull(), previewKey: text("preview_key").notNull(),
 mime: text("mime").notNull(), filename: text("filename").notNull(), size: integer("size").notNull(),
 revision: integer("revision").notNull().default(1), createdAt: text("created_at").notNull()
});
export const modelConfig = sqliteTable("atlas_model_config", {ownerId:text("owner_id").primaryKey(),provider:text("provider").notNull(),protocol:text("protocol").notNull(),baseUrl:text("base_url").notNull(),model:text("model").notNull(),keyCipher:text("key_cipher").notNull(),updatedAt:text("updated_at").notNull()});
