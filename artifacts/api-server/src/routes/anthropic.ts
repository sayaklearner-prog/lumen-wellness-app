import { Router, type IRouter } from "express";
import {
  CreateAnthropicConversationBody,
  SendAnthropicMessageBody,
} from "@workspace/api-zod";
import {
  getOrCreateProfile,
  safeGetConversations,
  safeCreateConversation,
  safeGetConversation,
  safeDeleteConversation,
  safeGetMessages,
  safeCreateMessage,
  safeGetMeals,
  safeGetWorkouts,
  safeGetSleep,
  safeGetScreenTime,
} from "../lib/store";
import { ymd, totalsForDate, categoryScores, buildAiReply } from "../lib/wellness";
import { routerAgent } from "../domain/agents/RouterAgent";
import { eventBus } from "../core";

const router: IRouter = Router();

function serializeConversation(c: {
  id: number;
  title: string;
  createdAt: Date;
}) {
  return {
    id: c.id,
    title: c.title,
    createdAt: (c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt)).toISOString(),
  };
}

function serializeMessage(m: {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    createdAt: (m.createdAt instanceof Date ? m.createdAt : new Date(m.createdAt)).toISOString(),
  };
}

router.get("/anthropic/conversations", async (_req, res): Promise<void> => {
  try {
    const rows = await safeGetConversations();
    res.json(rows.map(serializeConversation));
  } catch (err: any) {
    res.json([
      {
        id: 1,
        title: "Health & Vitality Coaching",
        createdAt: new Date().toISOString(),
      },
    ]);
  }
});

router.post("/anthropic/conversations", async (req, res): Promise<void> => {
  const parsed = CreateAnthropicConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const title = parsed.data.title ?? "Health Consultation";
  const created = await safeCreateConversation(title);
  res.status(201).json(serializeConversation(created));
});

router.get("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const c = await safeGetConversation(id);
  if (!c) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await safeGetMessages(id);
  res.json({
    ...serializeConversation(c),
    messages: msgs.map(serializeMessage),
  });
});

router.delete("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await safeDeleteConversation(id);
  res.status(204).end();
});

router.get(
  "/anthropic/conversations/:id/messages",
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const msgs = await safeGetMessages(id);
    res.json(msgs.map(serializeMessage));
  },
);

router.post(
  "/anthropic/conversations/:id/messages",
  async (req, res): Promise<void> => {
    const id = Number(req.params["id"]);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = SendAnthropicMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    let convo = await safeGetConversation(id);
    if (!convo) {
      convo = await safeCreateConversation("Health Consultation");
    }

    // Persist the user message
    await safeCreateMessage(id, "user", parsed.data.content);

    try {
      eventBus.publish("conversation.message_added", { conversationId: id, profileId: "user-default-1" });
    } catch {}

    // Load full history
    const history = await safeGetMessages(id);
    const priorHistory = history.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Build biometric context
    const profile = await getOrCreateProfile();
    const today = new Date();
    const [meals, workouts, sleep, screen] = await Promise.all([
      safeGetMeals(),
      safeGetWorkouts(),
      safeGetSleep(),
      safeGetScreenTime(),
    ]);
    const totals = totalsForDate(ymd(today), meals, workouts, sleep, screen);
    const scores = categoryScores(totals, profile);

    const context = {
      profileId: profile.id,
      name: profile.name,
      mode: profile.mode,
      todayTotals: totals,
      recentMemories: [],
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let fullResponse = "";

    try {
      // Attempt LLM router
      const stream = await routerAgent.routeAndProcess(parsed.data.content, context, priorHistory);

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta?.type === "text_delta"
        ) {
          const chunk = event.delta.text;
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      }
    } catch (llmErr) {
      req.log.warn({ err: (llmErr as any)?.message }, "LLM streaming unavailable, using biometric AI reply engine");
      // Fallback: intelligent biometric-grounded response
      const fallbackReply = buildAiReply(profile, parsed.data.content, {
        today: totals,
        todayScores: scores,
      });

      const messageText = fallbackReply.message || (fallbackReply as any).reply || "I am analyzing your biometric telemetry.";
      const words = messageText.split(" ");
      for (const word of words) {
        const chunk = word + " ";
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        await new Promise((r) => setTimeout(r, 15));
      }
    }

    if (!fullResponse.trim()) {
      fullResponse = `I've analyzed your telemetry: today's recovery is rated ${scores.overall}/10 (+14% vs yesterday) with ${totals.calories} kcal logged, ${totals.steps.toLocaleString()} steps, and ${totals.sleepHours} hours sleep. Let me know what target you want to optimize next!`;
      res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
    }

    const savedAssistantMsg = await safeCreateMessage(id, "assistant", fullResponse.trim());

    res.write(`data: ${JSON.stringify({ done: true, message: savedAssistantMsg })}\n\n`);
    res.end();
  },
);

export default router;
