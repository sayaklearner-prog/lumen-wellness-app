import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  mealsTable,
  workoutsTable,
  sleepTable,
  screenTimeTable,
  glucoseReadingsTable,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  CreateAnthropicConversationBody,
  SendAnthropicMessageBody,
} from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/store";
import { ymd, totalsForDate, categoryScores } from "../lib/wellness";

const router: IRouter = Router();

function serializeConversation(c: {
  id: number;
  title: string;
  createdAt: Date;
}) {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
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
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/anthropic/conversations", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(rows.map(serializeConversation));
});

router.post("/anthropic/conversations", async (req, res): Promise<void> => {
  const parsed = CreateAnthropicConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();
  res.status(201).json(serializeConversation(created!));
});

router.get("/anthropic/conversations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!c) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
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
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.delete(conversations).where(eq(conversations.id, id));
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
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    res.json(msgs.map(serializeMessage));
  },
);

import { routerAgent } from "../domain/agents/RouterAgent";
import { MemoryRepository } from "../repositories/MemoryRepository";
import { eventBus, featureFlags } from "../core";
import { AgentContext } from "../domain/agents/BaseAgent";

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

    const [convo] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!convo) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Persist the user message first.
    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content: parsed.data.content,
    });

    // Notify memory summarizer asynchronously
    eventBus.publish("conversation.message_added", { conversationId: id, profileId: "user-default-1" });

    // Load full history and build the message list.
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    // Exclude the very last message from history since we pass it explicitly as the current message
    const priorHistory = history.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Build context
    const profile = await getOrCreateProfile();
    const today = new Date();
    const [meals, workouts, sleep, screen] = await Promise.all([
      db.select().from(mealsTable),
      db.select().from(workoutsTable),
      db.select().from(sleepTable),
      db.select().from(screenTimeTable),
    ]);
    const totals = totalsForDate(ymd(today), meals, workouts, sleep, screen);

    let recentMemories: string[] = [];
    if (featureFlags.isEnabled("enable_pgvector_search")) {
      const memoryRepo = new MemoryRepository();
      // Dummy embedding for retrieval in absence of real embedding API
      const dummyEmbedding = new Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      const memoryRows = await memoryRepo.findSimilarMemories(dummyEmbedding, 3, 0.7);
      recentMemories = memoryRows.map(m => m.content);
    }

    const context: AgentContext = {
      profileId: profile.id,
      name: profile.name,
      mode: profile.mode,
      todayTotals: totals,
      recentMemories,
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let fullResponse = "";

    try {
      const stream = await routerAgent.routeAndProcess(parsed.data.content, context, priorHistory);

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          res.write(
            `data: ${JSON.stringify({ content: event.delta.text })}\n\n`,
          );
        }
      }

      await db.insert(messages).values({
        conversationId: id,
        role: "assistant",
        content: fullResponse,
      });

      // Auto-title untitled conversations from the first user message.
      if (
        convo.title === "New chat" ||
        convo.title === "Untitled" ||
        convo.title.trim() === ""
      ) {
        const newTitle = parsed.data.content.slice(0, 60).trim();
        if (newTitle.length > 0) {
          await db
            .update(conversations)
            .set({ title: newTitle })
            .where(eq(conversations.id, id));
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      req.log.error({ err }, "Multi-agent stream failed");
      res.write(
        `data: ${JSON.stringify({ error: "Stream failed", done: true })}\n\n`,
      );
      res.end();
    }
  },
);

export default router;
