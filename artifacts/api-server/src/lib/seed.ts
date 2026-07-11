import {
  db,
  mealsTable,
  workoutsTable,
  sleepTable,
  screenTimeTable,
  remindersTable,
} from "@workspace/db";
import { logger } from "./logger";
import { getOrCreateProfile } from "./store";

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function setTime(d: Date, h: number, m: number) {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
}

export async function seedIfEmpty() {
  await getOrCreateProfile();

  const existingMeals = await db.select().from(mealsTable).limit(1);
  if (existingMeals.length > 0) {
    logger.info("Seed skipped — data already present");
    return;
  }

  const today = new Date();
  const mealsToInsert: (typeof mealsTable.$inferInsert)[] = [];
  const workoutsToInsert: (typeof workoutsTable.$inferInsert)[] = [];
  const sleepToInsert: (typeof sleepTable.$inferInsert)[] = [];
  const screenToInsert: (typeof screenTimeTable.$inferInsert)[] = [];

  // Helper meals catalog
  const breakfastChoices = [
    { name: "Oat bowl with berries", calories: 380, p: 14, c: 60, f: 9 },
    { name: "Greek yogurt parfait", calories: 320, p: 22, c: 38, f: 8 },
    { name: "Avocado toast & egg", calories: 410, p: 18, c: 38, f: 22 },
    { name: "Protein smoothie", calories: 360, p: 32, c: 35, f: 8 },
  ];
  const lunchChoices = [
    { name: "Grilled chicken bowl", calories: 620, p: 47, c: 62, f: 14 },
    { name: "Quinoa salmon plate", calories: 590, p: 40, c: 50, f: 22 },
    { name: "Turkey wrap & salad", calories: 540, p: 36, c: 48, f: 18 },
    { name: "Tofu stir-fry", calories: 510, p: 28, c: 55, f: 16 },
  ];
  const dinnerChoices = [
    { name: "Baked salmon, asparagus, quinoa", calories: 580, p: 42, c: 38, f: 22 },
    { name: "Lean beef stir-fry & rice", calories: 640, p: 38, c: 60, f: 20 },
    { name: "Chickpea curry & basmati", calories: 560, p: 22, c: 78, f: 14 },
    { name: "Grilled chicken pasta", calories: 610, p: 40, c: 65, f: 16 },
  ];
  const snackChoices = [
    { name: "Almonds + apple", calories: 260, p: 6, c: 30, f: 14 },
    { name: "Cottage cheese & berries", calories: 180, p: 18, c: 14, f: 4 },
    { name: "Protein bar", calories: 220, p: 20, c: 22, f: 7 },
  ];

  for (let i = 13; i >= 0; i--) {
    const day = addDays(today, -i);
    const isToday = i === 0;
    const seed = (i * 31 + 7) % 4;

    const b = breakfastChoices[seed % breakfastChoices.length]!;
    const l = lunchChoices[(seed + 1) % lunchChoices.length]!;
    const dn = dinnerChoices[(seed + 2) % dinnerChoices.length]!;
    const sn = snackChoices[(seed + 1) % snackChoices.length]!;

    mealsToInsert.push({
      name: b.name,
      mealType: "breakfast",
      calories: b.calories,
      proteinGrams: b.p,
      carbsGrams: b.c,
      fatGrams: b.f,
      items: [],
      source: "manual",
      loggedAt: setTime(day, 8, 15),
    });
    mealsToInsert.push({
      name: l.name,
      mealType: "lunch",
      calories: l.calories,
      proteinGrams: l.p,
      carbsGrams: l.c,
      fatGrams: l.f,
      items: [],
      source: i % 3 === 0 ? "ai_camera" : "manual",
      loggedAt: setTime(day, 12, 45),
    });
    if (!isToday || today.getHours() >= 14) {
      mealsToInsert.push({
        name: sn.name,
        mealType: "snack",
        calories: sn.calories,
        proteinGrams: sn.p,
        carbsGrams: sn.c,
        fatGrams: sn.f,
        items: [],
        source: "manual",
        loggedAt: setTime(day, 15, 30),
      });
    }
    if (!isToday || today.getHours() >= 19) {
      mealsToInsert.push({
        name: dn.name,
        mealType: "dinner",
        calories: dn.calories,
        proteinGrams: dn.p,
        carbsGrams: dn.c,
        fatGrams: dn.f,
        items: [],
        source: "manual",
        loggedAt: setTime(day, 19, 30),
      });
    }

    // Workouts: walk most days, strength every 3rd
    workoutsToInsert.push({
      type: "walk",
      durationMinutes: 30 + ((i * 7) % 20),
      caloriesBurned: 180 + ((i * 5) % 40),
      steps: 5500 + ((i * 313) % 4000),
      intensity: "moderate",
      source: i % 4 === 0 ? "sensor" : "manual",
      loggedAt: setTime(day, 7, 15),
    });
    if (i % 2 === 0) {
      workoutsToInsert.push({
        type: i % 4 === 0 ? "strength" : "yoga",
        durationMinutes: i % 4 === 0 ? 45 : 30,
        caloriesBurned: i % 4 === 0 ? 280 : 150,
        steps: 0,
        intensity: i % 4 === 0 ? "vigorous" : "light",
        source: "manual",
        loggedAt: setTime(day, 18, 0),
      });
    }
    if (i % 3 === 1) {
      workoutsToInsert.push({
        type: "cycle",
        durationMinutes: 25,
        caloriesBurned: 220,
        steps: 0,
        intensity: "moderate",
        source: "manual",
        loggedAt: setTime(day, 17, 30),
      });
    }

    // Sleep — past nights only
    if (i > 0) {
      const dur = (7 + ((i * 0.31) % 1.6)).toFixed(2);
      const qual = i % 5 === 0 ? "fair" : i % 7 === 0 ? "excellent" : "good";
      sleepToInsert.push({
        date: ymd(day),
        durationHours: dur,
        quality: qual,
        bedtime: i % 2 === 0 ? "22:45" : "23:15",
        wakeTime: "06:30",
        deepSleepHours: (1.4 + ((i * 0.13) % 0.8)).toFixed(2),
        notes: null,
      });
    }

    // Screen time
    screenToInsert.push({
      date: ymd(day),
      totalMinutes: 140 + ((i * 23) % 90),
      socialMinutes: 50 + ((i * 11) % 40),
      productivityMinutes: 40 + ((i * 7) % 30),
      entertainmentMinutes: 30 + ((i * 13) % 50),
      otherMinutes: 20 + ((i * 5) % 20),
    });
  }

  await db.insert(mealsTable).values(mealsToInsert);
  await db.insert(workoutsTable).values(workoutsToInsert);
  if (sleepToInsert.length) await db.insert(sleepTable).values(sleepToInsert);
  await db.insert(screenTimeTable).values(screenToInsert);

  await db.insert(remindersTable).values([
    {
      title: "Morning hydration check",
      time: "07:30",
      category: "hydration",
      enabled: true,
      repeatDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      aiGenerated: false,
    },
    {
      title: "Stand + stretch break",
      time: "11:00",
      category: "movement",
      enabled: true,
      repeatDays: ["mon", "tue", "wed", "thu", "fri"],
      aiGenerated: true,
    },
    {
      title: "Log lunch",
      time: "13:00",
      category: "meal",
      enabled: true,
      repeatDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      aiGenerated: false,
    },
    {
      title: "Afternoon walk",
      time: "15:30",
      category: "movement",
      enabled: true,
      repeatDays: ["mon", "tue", "wed", "thu", "fri"],
      aiGenerated: true,
    },
    {
      title: "Wind down — screens off",
      time: "21:30",
      category: "screen",
      enabled: true,
      repeatDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      aiGenerated: true,
    },
    {
      title: "Two-minute breath practice",
      time: "20:00",
      category: "mindfulness",
      enabled: false,
      repeatDays: ["mon", "wed", "fri"],
      aiGenerated: true,
    },
  ]);

  logger.info(
    {
      meals: mealsToInsert.length,
      workouts: workoutsToInsert.length,
      sleep: sleepToInsert.length,
      screen: screenToInsert.length,
    },
    "Seed complete",
  );
}
