import Anthropic from "@anthropic-ai/sdk";

let anthropicInstance: Anthropic | null = null;

export const getAnthropicClient = (): Anthropic => {
  if (anthropicInstance) return anthropicInstance;

  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

  if (!baseURL) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_BASE_URL must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  if (!apiKey) {
    throw new Error(
      "AI_INTEGRATIONS_ANTHROPIC_API_KEY must be set. Did you forget to provision the Anthropic AI integration?",
    );
  }

  anthropicInstance = new Anthropic({
    apiKey,
    baseURL,
  });

  return anthropicInstance;
};

// Export a proxy object that mimics Anthropic to avoid breaking existing static imports
export const anthropic = new Proxy({} as Anthropic, {
  get(target, prop, receiver) {
    const client = getAnthropicClient();
    const value = Reflect.get(client, prop);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  }
});
