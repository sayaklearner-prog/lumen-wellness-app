import {
  pgTable,
  text,
  uuid,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  date,
  index,
} from "drizzle-orm/pg-core";

// Single-user demo: there's a single profile row.
export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  avatarColor: text("avatar_color").notNull().default("aurora"),
  mode: text("mode").notNull().default("standard"),
  premium: boolean("premium").notNull().default(false),
  dailyCalorieTarget: integer("daily_calorie_target").notNull().default(2100),
  dailyProteinTarget: integer("daily_protein_target").notNull().default(110),
  dailySleepTargetHours: numeric("daily_sleep_target_hours", { precision: 4, scale: 2 })
    .notNull()
    .default("8.00"),
  dailyStepsTarget: integer("daily_steps_target").notNull().default(9000),
  dailyScreenTimeLimitMinutes: integer("daily_screen_time_limit_minutes")
    .notNull()
    .default(180),
  // Diabetes-specific
  glucoseTargetLow: integer("glucose_target_low").notNull().default(80),
  glucoseTargetHigh: integer("glucose_target_high").notNull().default(140),
  dailyCarbLimit: integer("daily_carb_limit").notNull().default(180),
  // Onboarding + permissions
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  voiceEnabled: boolean("voice_enabled").notNull().default(true),
  motionPermissionGranted: boolean("motion_permission_granted").notNull().default(false),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(false),
  // Personal context for AI (collected in extended onboarding)
  fitnessExperience: text("fitness_experience").notNull().default("beginner"), // beginner|intermediate|advanced
  primaryGoal: text("primary_goal").notNull().default("general_wellness"), // general_wellness|lose_weight|build_muscle|manage_condition|improve_sleep|reduce_stress|increase_energy
  allergies: text("allergies").array().notNull().default([]),
  medications: text("medications").array().notNull().default([]),
  medicalDisclaimerAcceptedAt: timestamp("medical_disclaimer_accepted_at", {
    withTimezone: true,
  }),
  // Monetization
  premiumTier: text("premium_tier").notNull().default("free"), // free|plus|pro
  premiumSince: timestamp("premium_since", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mealsTable = pgTable("meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  mealType: text("meal_type").notNull(),
  calories: integer("calories").notNull(),
  proteinGrams: integer("protein_grams").notNull(),
  carbsGrams: integer("carbs_grams").notNull(),
  fatGrams: integer("fat_grams").notNull(),
  items: jsonb("items").notNull().default([]),
  photoUrl: text("photo_url"),
  source: text("source").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  loggedAtIndex: index("meals_logged_at_idx").on(table.loggedAt),
}));

export const workoutsTable = pgTable("workouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  caloriesBurned: integer("calories_burned").notNull(),
  steps: integer("steps").notNull().default(0),
  intensity: text("intensity").notNull(),
  source: text("source").notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  loggedAtIndex: index("workouts_logged_at_idx").on(table.loggedAt),
}));

export const sleepTable = pgTable("sleep_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  durationHours: numeric("duration_hours", { precision: 4, scale: 2 }).notNull(),
  quality: text("quality").notNull(),
  bedtime: text("bedtime").notNull(),
  wakeTime: text("wake_time").notNull(),
  deepSleepHours: numeric("deep_sleep_hours", { precision: 4, scale: 2 }),
  notes: text("notes"),
}, (table) => ({
  dateIndex: index("sleep_date_idx").on(table.date),
}));

export const screenTimeTable = pgTable("screen_time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  totalMinutes: integer("total_minutes").notNull(),
  socialMinutes: integer("social_minutes").notNull().default(0),
  productivityMinutes: integer("productivity_minutes").notNull().default(0),
  entertainmentMinutes: integer("entertainment_minutes").notNull().default(0),
  otherMinutes: integer("other_minutes").notNull().default(0),
}, (table) => ({
  dateIndex: index("screen_time_date_idx").on(table.date),
}));

export const remindersTable = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  time: text("time").notNull(),
  category: text("category").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  repeatDays: text("repeat_days").array().notNull().default([]),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sensorActivityTable = pgTable("sensor_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  steps: integer("steps").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  intensity: text("intensity").notNull(),
  sampleCount: integer("sample_count").notNull(),
  // Enhanced sensor data
  avgAccelMagnitude: numeric("avg_accel_magnitude", { precision: 6, scale: 3 }),
  peakAccelMagnitude: numeric("peak_accel_magnitude", { precision: 6, scale: 3 }),
  avgRotationRate: numeric("avg_rotation_rate", { precision: 6, scale: 3 }),
  estimatedDistanceMeters: integer("estimated_distance_meters"),
  caloriesEstimated: integer("calories_estimated"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  loggedAtIndex: index("sensor_activity_logged_at_idx").on(table.loggedAt),
}));

// In-app focus tracking (the only realistic web "screen time" — time the user is in this app).
export const appFocusSessionsTable = pgTable("app_focus_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  category: text("category").notNull(), // dashboard|coach|nutrition|activity|sleep|screen-time|planner|badges|settings|other
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
}, (table) => ({
  dateIndex: index("app_focus_sessions_date_idx").on(table.date),
}));

// Connected health platforms (Apple Health import, Google Fit OAuth, manual fitness band entries).
export const healthConnectionsTable = pgTable("health_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull(), // apple_health|google_fit|fitbit|garmin|oura|whoop|manual
  status: text("status").notNull().default("disconnected"), // connected|disconnected|pending
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncedRecordCount: integer("synced_record_count").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Diabetes-specific glucose readings (mg/dL).
export const glucoseReadingsTable = pgTable("glucose_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  valueMgDl: integer("value_mg_dl").notNull(),
  context: text("context").notNull(), // fasting|pre_meal|post_meal|bedtime|random
  notes: text("notes"),
  source: text("source").notNull().default("manual"), // manual|cgm|imported
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  loggedAtIndex: index("glucose_readings_logged_at_idx").on(table.loggedAt),
}));

// AI-generated structured "Today's Plan" — cached per day.
export const dailyPlansTable = pgTable("daily_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull().unique(),
  planJson: jsonb("plan_json").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Habit completion ledger — daily check-offs that drive streaks.
export const habitCompletionsTable = pgTable("habit_completions", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull(),
  habitKey: text("habit_key").notNull(), // log_breakfast|hit_steps|log_water|sleep_window|log_glucose_morning|coach_checkin|move_break|log_dinner ...
  source: text("source").notNull().default("user"), // user|auto
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  dateIndex: index("habit_completions_date_idx").on(table.date),
}));

// AI message usage ledger — for free-tier daily quota gating.
export const aiMessageUsageTable = pgTable("ai_message_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: date("date").notNull().unique(),
  count: integer("count").notNull().default(0),
});

export type Profile = typeof profilesTable.$inferSelect;
export type Meal = typeof mealsTable.$inferSelect;
export type Workout = typeof workoutsTable.$inferSelect;
export type SleepRow = typeof sleepTable.$inferSelect;
export type ScreenTimeRow = typeof screenTimeTable.$inferSelect;
export type ReminderRow = typeof remindersTable.$inferSelect;
export type SensorActivityRow = typeof sensorActivityTable.$inferSelect;
export type AppFocusSessionRow = typeof appFocusSessionsTable.$inferSelect;
export type HealthConnectionRow = typeof healthConnectionsTable.$inferSelect;
export type GlucoseReadingRow = typeof glucoseReadingsTable.$inferSelect;
export type DailyPlanRow = typeof dailyPlansTable.$inferSelect;
export type HabitCompletionRow = typeof habitCompletionsTable.$inferSelect;
export type AiMessageUsageRow = typeof aiMessageUsageTable.$inferSelect;
