import { db, profilesTable, remindersTable } from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";

export class ProactiveWorker {
  async runDailyCheck() {
    logger.info("Running proactive daily check for all users");
    try {
      const users = await db.select().from(profilesTable);
      for (const user of users) {
        await this.generateProactiveInsight(user.id, user.name);
      }
    } catch (error) {
      logger.error({ error }, "Failed to run proactive check");
    }
  }

  private async generateProactiveInsight(profileId: string, name: string) {
    // In a real implementation, this would aggregate yesterday's totals
    // and use an agent to generate a personalized push notification.
    const prompt = `You are an AI wellness coach. Generate a single, short, personalized push notification (under 100 characters) for ${name} to encourage them today.`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 50,
        system: "Output only the notification text.",
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "You've got this today!";
      
      // Store it as a reminder/notification for the user to see in app
      await db.insert(remindersTable).values({
        title: text,
        time: "09:00",
        category: "coach_insight",
        aiGenerated: true,
      });

      logger.info({ profileId, notification: text }, "Generated proactive insight");
    } catch (error) {
      logger.error({ error, profileId }, "Failed to generate insight");
    }
  }
}

export const proactiveWorker = new ProactiveWorker();
