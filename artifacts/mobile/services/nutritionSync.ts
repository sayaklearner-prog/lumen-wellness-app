/**
 * LUMEN NUTRITION TELEMETRY & CROSS-TAB SYNCHRONIZATION ENGINE
 * 
 * Provides a single source of truth for daily nutrition, calories, and macronutrient flux.
 * - Bridges SQLite master database, persistent local storage, and real-time tab state.
 * - Handles local vs UTC timezone date boundaries cleanly.
 * - Delivers instantaneous 0ms synchronization when meals are added, edited, or deleted.
 */

import { getMeals, MealRecord, formatDateKey } from "./db";
import { storage } from "./storage";

type NutritionChangeListener = () => void;
const listeners = new Set<NutritionChangeListener>();

/**
 * Checks if a meal's loggedAt timestamp corresponds to the target calendar date (local time).
 */
export function isMealLoggedOnDate(
  loggedAt: string | undefined | null,
  targetDateKey: string = formatDateKey()
): boolean {
  if (!loggedAt) return false;

  // 1. Direct string prefix match (e.g., "2026-11-08T...")
  if (loggedAt.startsWith(targetDateKey)) return true;

  // 2. Parse ISO timestamp into local timezone Date
  try {
    const d = new Date(loggedAt);
    if (!isNaN(d.getTime())) {
      return formatDateKey(d) === targetDateKey;
    }
  } catch {}

  return false;
}

/**
 * Fetches and aggregates all logged meals for a specific local date from both SQLite and storage fallback.
 */
export async function getAggregatedMealsForDate(
  targetDateKey: string = formatDateKey()
): Promise<MealRecord[]> {
  const allCandidateMeals: MealRecord[] = [];

  // 1. Fetch from master SQLite database using indexed date window
  try {
    const dbMeals = await getMeals(targetDateKey);
    if (Array.isArray(dbMeals)) {
      allCandidateMeals.push(...dbMeals);
    }
  } catch (err) {
    console.warn("[NutritionSync] Failed to read from SQLite:", err);
  }

  // 2. Fetch from local storage fallback
  try {
    const stored = await storage.getItem("lumen_local_meals");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        allCandidateMeals.push(...parsed);
      }
    }
  } catch (err) {
    console.warn("[NutritionSync] Failed to read from storage fallback:", err);
  }

  // 3. De-duplicate meals by id and (name + mealType + timestamp)
  const uniqueMeals: MealRecord[] = [];
  const seenIds = new Set<string>();

  for (const m of allCandidateMeals) {
    if (!m || !m.name) continue;
    // Exclude legacy mock items
    if (
      m.name === "Avocado Sourdough Toast & Poached Egg" ||
      m.name === "Avocado Toast & Poached Egg" ||
      m.name === "Grilled Chicken & Brown Rice Bowl" ||
      m.name === "Wild Atlantic Salmon & Quinoa" ||
      m.name === "Whey Protein Super Smoothie" ||
      m.id === "meal-scan-mock"
    ) {
      continue;
    }

    const dedupeKey = m.id ? String(m.id) : `${m.name}-${m.mealType}-${(m.loggedAt || "").slice(0, 16)}`;
    if (!seenIds.has(dedupeKey)) {
      seenIds.add(dedupeKey);
      uniqueMeals.push(m);
    }
  }

  // 4. Filter strictly by local calendar date
  return uniqueMeals.filter((m) => isMealLoggedOnDate(m.loggedAt, targetDateKey));
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
  meals: MealRecord[];
}

/**
 * Computes exact calorie and macronutrient sums for a given calendar date.
 */
export async function getNutritionTotalsForDate(
  targetDateKey: string = formatDateKey()
): Promise<NutritionTotals> {
  const meals = await getAggregatedMealsForDate(targetDateKey);

  const calories = meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
  const protein = meals.reduce((sum, m) => sum + (Number(m.proteinGrams) || 0), 0);
  const carbs = meals.reduce((sum, m) => sum + (Number(m.carbsGrams) || 0), 0);
  const fat = meals.reduce((sum, m) => sum + (Number(m.fatGrams) || 0), 0);

  return {
    calories,
    protein,
    carbs,
    fat,
    count: meals.length,
    meals,
  };
}

/**
 * Subscribe to real-time nutrition changes (dispatched on meal log/delete).
 */
export function subscribeNutritionChanges(listener: NutritionChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Dispatches notification to all tabs that nutrition state has changed.
 */
export function notifyNutritionChanges(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.warn("[NutritionSync] Error calling listener:", err);
    }
  });
}
