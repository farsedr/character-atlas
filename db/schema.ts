import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const labels = sqliteTable("atlas_labels", {
 key:text("key").primaryKey(),dimension:text("dimension").notNull(),name:text("name").notNull(),source:text("source").notNull(),createdAt:text("created_at").notNull(),
 ownerId:text("owner_id"),groupName:text("group_name").notNull().default("新增标签")
});
export const assets = sqliteTable("atlas_assets",{
 id:text("id").primaryKey(),body:text("body").notNull(),originalKey:text("original_key").notNull(),previewKey:text("preview_key").notNull(),mime:text("mime").notNull(),filename:text("filename").notNull(),size:integer("size").notNull(),revision:integer("revision").notNull().default(1),createdAt:text("created_at").notNull(),
 ownerId:text("owner_id"),displayNumber:integer("display_number"),deletedAt:text("deleted_at")
},t=>[uniqueIndex("atlas_owner_number").on(t.ownerId,t.displayNumber).where(sql`deleted_at IS NULL`)]);
export const modelConfig=sqliteTable("atlas_model_config",{ownerId:text("owner_id").primaryKey(),provider:text("provider").notNull(),protocol:text("protocol").notNull(),baseUrl:text("base_url").notNull(),model:text("model").notNull(),keyCipher:text("key_cipher").notNull(),updatedAt:text("updated_at").notNull()});
export const users=sqliteTable("atlas_users",{id:text("id").primaryKey(),email:text("email").notNull().unique(),name:text("name").notNull(),passwordHash:text("password_hash").notNull(),salt:text("salt").notNull(),recoveryHash:text("recovery_hash").notNull(),disabled:integer("disabled").notNull().default(0),createdAt:text("created_at").notNull()});
export const sessions=sqliteTable("atlas_sessions",{hash:text("hash").primaryKey(),userId:text("user_id").notNull(),createdAt:text("created_at").notNull(),expiresAt:integer("expires_at").notNull(),agent:text("agent").notNull()});
export const limits=sqliteTable("atlas_limits",{key:text("key").primaryKey(),count:integer("count").notNull(),expiresAt:integer("expires_at").notNull()});
export const projects=sqliteTable("atlas_projects",{id:text("id").primaryKey(),ownerId:text("owner_id").notNull(),name:text("name").notNull(),nameKey:text("name_key").notNull().unique(),createdAt:text("created_at").notNull()});

export const analysisSkills=sqliteTable("atlas_analysis_skills",{ownerId:text("owner_id").primaryKey(),name:text("name").notNull(),content:text("content").notNull(),updatedAt:text("updated_at").notNull()});
