import { anthropic } from "@workspace/integrations-anthropic-ai";

export type AgentContext = {
  profileId: string;
  name: string;
  mode: string;
  todayTotals: Record<string, any>;
  recentMemories: string[];
};

// Unified stream adapter for OpenAI / GPT-4
async function* streamOpenAi(systemPrompt: string, history: any[], message: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";

  const openaiMessages = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: message },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o", // standard production GPT-4 model
      messages: openaiMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.statusText} - ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine === "data: [DONE]") continue;

      if (cleanLine.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(cleanLine.slice(6));
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) {
            yield {
              type: "content_block_delta",
              delta: {
                type: "text_delta",
                text,
              },
            };
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}

export abstract class BaseAgent {
  constructor(public readonly name: string, public readonly description: string) {}

  /**
   * Generates the specialized system prompt for this agent.
   */
  abstract getSystemPrompt(context: AgentContext): string;

  /**
   * Processes the user message, dynamically switching to GPT-4 if OPENAI_API_KEY is configured
   */
  async process(message: string, context: AgentContext, history: any[] = []): Promise<any> {
    const systemPrompt = this.getSystemPrompt(context);
    
    // Dynamic switch to GPT-4
    if (process.env.OPENAI_API_KEY) {
      return streamOpenAi(systemPrompt, history, message);
    }

    // Default fallback to Claude
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
