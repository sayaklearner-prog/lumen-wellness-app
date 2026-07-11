import { anthropic } from "@workspace/integrations-anthropic-ai";

export type AgentContext = {
  profileId: string;
  name: string;
  mode: string;
  todayTotals: Record<string, any>;
  recentMemories: string[];
};

export abstract class BaseAgent {
  constructor(public readonly name: string, public readonly description: string) {}

  /**
   * Generates the specialized system prompt for this agent.
   */
  abstract getSystemPrompt(context: AgentContext): string;

  /**
   * Processes the user message, optionally utilizing specialized tools, and returns the response stream or text.
   */
  async process(message: string, context: AgentContext, history: any[] = []): Promise<any> {
    const systemPrompt = this.getSystemPrompt(context);
    
    // Simplistic integration for now
    const stream = anthropic.messages.stream({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        ...history,
        { role: "user", content: message }
      ],
    });

    return stream;
  }
}
