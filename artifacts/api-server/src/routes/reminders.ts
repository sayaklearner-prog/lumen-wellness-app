import { Router, type IRouter } from "express";
import { db, remindersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  ListRemindersResponse,
  CreateReminderBody,
  UpdateReminderParams,
  UpdateReminderBody,
  UpdateReminderResponse,
  DeleteReminderParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Cat =
  | "hydration"
  | "meal"
  | "movement"
  | "sleep"
  | "screen"
  | "mindfulness"
  | "medication";

function toApi(row: typeof remindersTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    time: row.time,
    category: row.category as Cat,
    enabled: row.enabled,
    repeatDays: (row.repeatDays as string[]) as Day[],
    aiGenerated: row.aiGenerated,
  };
}

router.get("/reminders", async (req, res): Promise<void> => {
  const rows = await db.select().from(remindersTable).orderBy(asc(remindersTable.time));
  res.json(ListRemindersResponse.parse(rows.map(toApi)));
});

router.post("/reminders", async (req, res): Promise<void> => {
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(remindersTable)
    .values({
      title: parsed.data.title,
      time: parsed.data.time,
      category: parsed.data.category,
      enabled: parsed.data.enabled,
      repeatDays: parsed.data.repeatDays,
      aiGenerated: false,
    })
    .returning();
  res.status(201).json(toApi(row!));
});

router.patch("/reminders/:id", async (req, res): Promise<void> => {
  const params = UpdateReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateReminderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [row] = await db
    .update(remindersTable)
    .set(body.data)
    .where(eq(remindersTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  res.json(UpdateReminderResponse.parse(toApi(row)));
});

router.delete("/reminders/:id", async (req, res): Promise<void> => {
  const params = DeleteReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(remindersTable)
    .where(eq(remindersTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
