import { db, memoriesTable } from "@workspace/db";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";

export class MemoryRepository {
  async insertMemory(profileId: string, content: string, category: string, embedding: number[]) {
    return db.insert(memoriesTable).values({
      profileId,
      content,
      category,
      embedding,
    }).returning();
  }

  async findSimilarMemories(embedding: number[], limit = 5, threshold = 0.75) {
    // using pgvector cosine distance
    const similarity = sql<number>`1 - (${cosineDistance(memoriesTable.embedding, embedding)})`;
    return db
      .select({ id: memoriesTable.id, content: memoriesTable.content, similarity })
      .from(memoriesTable)
      .where(gt(similarity, threshold))
      .orderBy((t) => desc(t.similarity))
      .limit(limit);
  }
}
