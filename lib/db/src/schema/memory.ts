import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  vector,
  index,
} from "drizzle-orm/pg-core";

// Represents a persistent fact/memory about a user
export const memoriesTable = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), // e.g., nutrition_preference, injury, goal
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI ada-002 size
  confidenceScore: numeric("confidence_score", { precision: 4, scale: 2 }).notNull().default("1.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  embeddingIndex: index("memories_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  profileCategoryIndex: index("memories_profile_cat_idx").on(table.profileId, table.category),
}));

export type MemoryRow = typeof memoriesTable.$inferSelect;
