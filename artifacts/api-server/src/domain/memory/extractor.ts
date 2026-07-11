import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../../lib/logger";

export class MemoryExtractor {
  /**
   * Analyzes recent conversation messages and extracts explicit persistent facts.
   * Uses Claude to parse user statements into categorized memories.
   */
  async extractFacts(messages: { role: string, content: string }[]): Promise<{ category: string, fact: string }[]> {
    const prompt = `
Analyze the following conversation and extract any explicit, persistent facts about the user.
Ignore conversational filler or temporary states (e.g., "I'm tired today").
Focus on:
- Nutrition preferences (e.g., allergies, diets, favorite foods)
- Fitness context (e.g., injuries, past experience, goals)
- Schedule & Routine (e.g., works night shifts, prefers morning workouts)

Output ONLY a JSON array of objects with 'category' (string) and 'fact' (string). 
If no facts are present, output an empty array [].
    `;

    const chatText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // use faster, cheaper model for extraction
        max_tokens: 1024,
        system: prompt,
        messages: [{ role: "user", content: chatText }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
      return JSON.parse(text);
    } catch (error) {
      logger.error({ error }, "Failed to extract facts");
      return [];
    }
  }

  /**
   * Generates a vector embedding for a fact.
   * Note: In a real implementation, this would call an embedding API like OpenAI ada-002 or Voyage AI.
   * For now, we mock the embedding generation to return a dummy vector.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Mock implementation of a 1536-dimensional vector
    return new Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}

export const memoryExtractor = new MemoryExtractor();
