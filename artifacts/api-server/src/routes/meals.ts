import { Router, type IRouter } from "express";
import { db, mealsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListMealsQueryParams,
  ListMealsResponse,
  CreateMealBody,
  UpdateMealParams,
  UpdateMealBody,
  UpdateMealResponse,
  DeleteMealParams,
  RecognizeMealFromImageBody,
  RecognizeMealFromImageResponse,
} from "@workspace/api-zod";
import { mockRecognizeFood, ymd } from "../lib/wellness";

const router: IRouter = Router();

function toApi(row: typeof mealsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    mealType: row.mealType as "breakfast" | "lunch" | "dinner" | "snack",
    calories: row.calories,
    proteinGrams: row.proteinGrams,
    carbsGrams: row.carbsGrams,
    fatGrams: row.fatGrams,
    items: (row.items as unknown[]) ?? [],
    photoUrl: row.photoUrl,
    loggedAt: row.loggedAt,
    source: row.source as "manual" | "ai_camera",
  };
}

router.get("/meals", async (req, res): Promise<void> => {
  const parsed = ListMealsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db.select().from(mealsTable).orderBy(desc(mealsTable.loggedAt));
  const filtered = parsed.data.date
    ? rows.filter((r) => ymd(new Date(r.loggedAt)) === parsed.data.date)
    : rows;
  res.json(ListMealsResponse.parse(filtered.map(toApi)));
});

router.post("/meals", async (req, res): Promise<void> => {
  const parsed = CreateMealBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(mealsTable)
    .values({
      name: parsed.data.name,
      mealType: parsed.data.mealType,
      calories: parsed.data.calories,
      proteinGrams: parsed.data.proteinGrams,
      carbsGrams: parsed.data.carbsGrams,
      fatGrams: parsed.data.fatGrams,
      items: parsed.data.items ?? [],
      photoUrl: parsed.data.photoUrl ?? null,
      source: parsed.data.source,
    })
    .returning();
  res.status(201).json(toApi(row!));
});

router.patch("/meals/:id", async (req, res): Promise<void> => {
  const params = UpdateMealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateMealBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const update: Record<string, unknown> = { ...body.data };
  if (body.data.items !== undefined) update.items = body.data.items;
  const [row] = await db
    .update(mealsTable)
    .set(update)
    .where(eq(mealsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  res.json(UpdateMealResponse.parse(toApi(row)));
});

router.delete("/meals/:id", async (req, res): Promise<void> => {
  const params = DeleteMealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(mealsTable)
    .where(eq(mealsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meal not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/meals/recognize", async (req, res): Promise<void> => {
  const parsed = RecognizeMealFromImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Lightweight delay so the UI can show the analyzing state.
  await new Promise((r) => setTimeout(r, 750));
  const result = mockRecognizeFood(null);
  req.log.info({ recognized: result.name }, "Mock food recognition complete");
  res.json(RecognizeMealFromImageResponse.parse(result));
});

export default router;
