import { anthropic } from "@workspace/integrations-anthropic-ai";
import { FitnessCoach } from "./FitnessCoach";
import { NutritionCoach } from "./NutritionCoach";
import { BaseAgent, AgentContext } from "./BaseAgent";
import { logger } from "../../lib/logger";

export class RouterAgent {
  private fitness = new FitnessCoach();
  private nutrition = new NutritionCoach();
  
  // A generic fallback agent for other queries
  private genericFallback = new class extends BaseAgent {
    constructor() { super("GeneralWellness", "Fallback"); }
    getSystemPrompt(context: AgentContext) {
      return `You are Lumen's General Wellness Coach. Answer queries broadly related to wellness, sleep, screen time, or mindfulness.`;
    }
  }();

  async routeAndProcess(message: string, context: AgentContext, history: any[] = []): Promise<any> {
    // LLM-based lightweight intent classification
    const prompt = `
Analyze the user's latest message and categorize their intent into one of the following classes:
1. "FITNESS": Queries about workouts, exercises, muscle soreness, steps.
2. "NUTRITION": Queries about meals, food, calories, protein, recipes, glucose.
3. "GENERAL": Everything else, including sleep, screen time, or general chat.

User Message: "${message}"

Output ONLY the category name (FITNESS, NUTRITION, or GENERAL).
`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307", // use Haiku for fast routing
        max_tokens: 10,
        system: "You are a routing classifier. Output a single word.",
        messages: [{ role: "user", content: prompt }],
      });

      const intent = response.content[0]?.type === "text" ? response.content[0].text.trim().toUpperCase() : "GENERAL";
      logger.info({ intent, message }, "Router classified intent");

      let selectedAgent: BaseAgent;
      if (intent.includes("FITNESS")) selectedAgent = this.fitness;
      else if (intent.includes("NUTRITION")) selectedAgent = this.nutrition;
      else selectedAgent = this.genericFallback;

      return selectedAgent.process(message, context, history);
    } catch (error) {
      logger.error({ error }, "Router failed, falling back to general agent");
      return this.genericFallback.process(message, context, history);
    }
  }
}

export const routerAgent = new RouterAgent();
