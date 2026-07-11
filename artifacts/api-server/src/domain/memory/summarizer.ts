import { eventBus } from "../../core";
import { memoryExtractor } from "./extractor";
import { MemoryRepository } from "../../repositories/MemoryRepository";
import { logger } from "../../lib/logger";
import { db, messages } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

export class MemorySummarizer {
  private repo = new MemoryRepository();

  constructor() {
    // Listen for 'conversation.ended' or 'conversation.message_added' events
    // In a real system, we'd debounce this or run it on a background queue.
    eventBus.subscribe("conversation.message_added", async (payload: { conversationId: number, profileId: string }) => {
      logger.info({ conversationId: payload.conversationId }, "Running memory summarizer");
      await this.processConversation(payload.conversationId, payload.profileId);
    });
  }

  async processConversation(conversationId: number, profileId: string) {
    try {
      const history = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
      if (history.length < 2) return; // Need at least some back and forth

      // Get last N messages to avoid analyzing the whole history every time
      const recentMessages = history.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      const facts = await memoryExtractor.extractFacts(recentMessages);
      
      for (const fact of facts) {
        const embedding = await memoryExtractor.generateEmbedding(fact.fact);
        await this.repo.insertMemory(profileId, fact.fact, fact.category, embedding);
        logger.info({ category: fact.category, fact: fact.fact }, "Stored new memory");
      }
    } catch (error) {
      logger.error({ error, conversationId }, "Memory summarization failed");
    }
  }
}

export const memorySummarizer = new MemorySummarizer();
