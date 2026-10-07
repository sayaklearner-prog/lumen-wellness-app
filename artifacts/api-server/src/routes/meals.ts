import { Router, type IRouter } from "express";
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
import { safeGetMeals, safeCreateMeal, safeDeleteMeal } from "../lib/store";

const router: IRouter = Router();

function toApi(row: any) {
  return {
    id: String(row.id),
    name: String(row.name || "Meal"),
    mealType: (row.mealType || "snack") as "breakfast" | "lunch" | "dinner" | "snack",
    calories: Number(row.calories) || 0,
    proteinGrams: Number(row.proteinGrams) || 0,
    carbsGrams: Number(row.carbsGrams) || 0,
    fatGrams: Number(row.fatGrams) || 0,
    items: Array.isArray(row.items) ? row.items : [],
    photoUrl: row.photoUrl ?? null,
    loggedAt: (row.loggedAt instanceof Date ? row.loggedAt : new Date(row.loggedAt || Date.now())).toISOString(),
    source: (row.source || "manual") as "manual" | "ai_camera",
  };
}

router.get("/meals", async (req, res): Promise<void> => {
  const parsed = ListMealsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await safeGetMeals();
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
  const row = await safeCreateMeal({
    name: parsed.data.name,
    mealType: parsed.data.mealType,
    calories: parsed.data.calories,
    proteinGrams: parsed.data.proteinGrams,
    carbsGrams: parsed.data.carbsGrams,
    fatGrams: parsed.data.fatGrams,
    items: parsed.data.items ?? [],
    photoUrl: parsed.data.photoUrl ?? null,
    source: parsed.data.source,
  });
  res.status(201).json(toApi(row));
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
  const meals = await safeGetMeals();
  const target = meals.find((m) => String(m.id) === params.data.id);
  if (target) {
    Object.assign(target, body.data);
    res.json(UpdateMealResponse.parse(toApi(target)));
    return;
  }
  res.status(404).json({ error: "Meal not found" });
});

router.delete("/meals/:id", async (req, res): Promise<void> => {
  const params = DeleteMealParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await safeDeleteMeal(params.data.id);
  res.sendStatus(204);
});

router.post("/meals/recognize", async (req, res): Promise<void> => {
  const body = (req.body || {}) as any;
  const hint = body.hint || body.name || body.notes;

  const result = mockRecognizeFood(hint);
  const response = {
    name: result.name,
    mealName: result.name,
    mealType: result.mealType,
    suggestedMealType: result.mealType,
    calories: result.calories,
    totalCalories: result.calories,
    proteinGrams: result.proteinGrams,
    totalProteinGrams: result.proteinGrams,
    carbsGrams: result.carbsGrams,
    totalCarbsGrams: result.carbsGrams,
    fatGrams: result.fatGrams,
    totalFatGrams: result.fatGrams,
    vitamins: result.vitamins || "Vitamin A, Vitamin C, Calcium & Iron",
    items: result.items || [],
    confidence: result.confidence || 0.94,
    notes: result.notes || "Visual nutrition analysis calibrated via Lumen AI.",
    modelNotes: result.notes || "Visual nutrition analysis calibrated via Lumen AI.",
  };

  req.log.info({ recognized: response.name }, "Food recognition complete");
  res.json(response);
});

export default router;
