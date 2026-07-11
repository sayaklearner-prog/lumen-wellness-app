import { db, mealsTable, workoutsTable, sleepTable, screenTimeTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { ymd } from "../lib/wellness";

export class WellnessRepository {
  async getDayTotals(dateKey: string) {
    const [meals, workouts, sleep, screen] = await Promise.all([
      db.select().from(mealsTable),
      db.select().from(workoutsTable),
      db.select().from(sleepTable).where(eq(sleepTable.date, dateKey)),
      db.select().from(screenTimeTable).where(eq(screenTimeTable.date, dateKey)),
    ]);

    // For larger scales, these filters should happen in SQL.
    // For now, keeping backward compatibility with the existing in-memory filters.
    const dayMeals = meals.filter((m) => ymd(new Date(m.loggedAt)) === dateKey);
    const dayWorkouts = workouts.filter((w) => ymd(new Date(w.loggedAt)) === dateKey);

    return { dayMeals, dayWorkouts, sleepRow: sleep[0], screenRow: screen[0] };
  }
}
