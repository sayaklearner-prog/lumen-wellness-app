import { Platform } from "react-native";

// ============================================================================
// LUMEN MASTER SQLITE DATABASE & PERSISTENT STORAGE ENGINE
// Full relational database on native (Android/iOS) + persistent adapter on Web
// Zero 2KB size limit, never resets on app close, ACID transactions
// ============================================================================

export interface MealRecord {
  id: string;
  name: string;
  mealType: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  vitamins?: string;
  items?: any[];
  photoUrl?: string;
  source: string;
  loggedAt: string;
}

export interface WorkoutRecord {
  id: string;
  type: string;
  durationMinutes: number;
  caloriesBurned: number;
  steps?: number;
  distanceKm?: number;
  avgHeartRate?: number;
  intensity?: string;
  notes?: string;
  loggedAt: string;
}

export interface SleepRecord {
  id: string;
  durationHours: number;
  quality: string;
  deepSleepHours?: number;
  remSleepHours?: number;
  bedtime?: string;
  wakeTime?: string;
  notes?: string;
  loggedAt: string;
}

export interface ScreenTimeRecord {
  id: string;
  screenMinutes: number;
  limitMinutes: number;
  productivityMinutes: number;
  socialMinutes: number;
  mediaMinutes: number;
  wellbeingMinutes: number;
  focusMode: boolean;
  windDown: boolean;
  loggedAt: string;
}

export interface FocusSessionRecord {
  id: string;
  sessionType: "pomodoro" | "deep_work" | "quick_focus" | "flow_state" | "custom";
  targetMinutes: number;
  completedSeconds: number;
  status: "completed" | "interrupted" | "active";
  distractingAppsBlocked: string[];
  reflectionScore?: number;
  reflectionNote?: string;
  startedAt: string;
  endedAt?: string;
}

export interface WellbeingConfigRecord {
  dailyLimitMinutes: number;
  windDownEnabled: boolean;
  windDownBedtime: string;
  windDownWakeup: string;
  blockedCategories: string[];
  dndAutoToggle: boolean;
}

export interface AlarmRecord {
  id: string;
  time: string;
  title: string;
  repeat: string;
  enabled: boolean;
  isAi?: boolean;
  soundEnabled: boolean;
  createdAt: string;
}

export interface CoachMessageRecord {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface CoachMemoryRecord {
  id: string;
  category: "nutrition" | "fitness" | "sleep" | "screentime" | "medical" | "preference" | "goal";
  keyFact: string;
  source: "user_chat" | "meal_log" | "workout_log" | "sleep_log" | "profile";
  confidence: number;
  createdAt: string;
}

export interface ProfileRecord {
  id: string;
  name: string;
  mode: string;
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  dailySleepTargetHours: number;
  dailyStepsTarget: number;
  updatedAt: string;
}

export interface DailyHealthRecord {
  date: string; // "YYYY-MM-DD"
  overallScore: number; // 0.0 - 10.0
  steps: number;
  activeCalories: number;
  distanceKm: number;
  nutritionScore: number;
  caloriesConsumed: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  sleepScore: number;
  sleepHours: number;
  sleepQuality?: string;
  hydrationScore: number;
  hydrationMl: number;
  hydrationCups: number;
  screenScore: number;
  screenMinutes: number;
  aiInsightsJson?: string;
  updatedAt: string;
}

export interface OfflineLog {
  id: number;
  category: string;
  endpoint: string;
  payload: string;
  queuedAt: string;
}

// In-memory web fallback store that mirrors SQLite schema and persists to localStorage
const WEB_STORAGE_KEY = "lumen_master_sql_store";

function getWebStore(): Record<string, any> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveWebStore(data: Record<string, any>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("Web localStorage save failed", e);
  }
}

let nativeDbInstance: any = null;
let isDbInitialized = false;

// Initialize Master Database
export async function getDb() {
  if (Platform.OS === "web") return null;
  if (nativeDbInstance && isDbInitialized) return nativeDbInstance;

  try {
    const SQLite = require("expo-sqlite");
    nativeDbInstance = await SQLite.openDatabaseAsync("lumen_master.db");

    // Execute schema creation with robust table definitions
    await nativeDbInstance.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        meal_type TEXT,
        calories REAL,
        protein_grams REAL,
        carbs_grams REAL,
        fat_grams REAL,
        vitamins TEXT,
        items_json TEXT,
        photo_url TEXT,
        source TEXT,
        logged_at TEXT
      );

      CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        duration_minutes INTEGER,
        calories_burned REAL,
        steps INTEGER,
        distance_km REAL,
        avg_heart_rate INTEGER,
        intensity TEXT,
        notes TEXT,
        logged_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sleep_sessions (
        id TEXT PRIMARY KEY,
        duration_hours REAL,
        quality TEXT,
        deep_sleep_hours REAL,
        rem_sleep_hours REAL,
        bedtime TEXT,
        wake_time TEXT,
        notes TEXT,
        logged_at TEXT
      );

      CREATE TABLE IF NOT EXISTS hydration_logs (
        id TEXT PRIMARY KEY,
        cups INTEGER,
        amount_ml INTEGER,
        logged_at TEXT
      );

      CREATE TABLE IF NOT EXISTS hydration_entries (
        id TEXT PRIMARY KEY,
        amount_ml INTEGER,
        beverage_type TEXT,
        logged_at TEXT
      );

      CREATE TABLE IF NOT EXISTS screentime_logs (
        id TEXT PRIMARY KEY,
        screen_minutes INTEGER,
        limit_minutes INTEGER,
        productivity_minutes INTEGER,
        social_minutes INTEGER,
        media_minutes INTEGER,
        wellbeing_minutes INTEGER,
        focus_mode INTEGER,
        wind_down INTEGER,
        logged_at TEXT
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        session_type TEXT,
        target_minutes INTEGER,
        completed_seconds INTEGER,
        status TEXT,
        distracting_apps TEXT,
        reflection_score INTEGER,
        reflection_note TEXT,
        started_at TEXT,
        ended_at TEXT
      );

      CREATE TABLE IF NOT EXISTS wellbeing_config (
        id TEXT PRIMARY KEY,
        daily_limit_minutes INTEGER,
        wind_down_enabled INTEGER,
        wind_down_bedtime TEXT,
        wind_down_wakeup TEXT,
        blocked_categories TEXT,
        dnd_auto_toggle INTEGER
      );

      CREATE TABLE IF NOT EXISTS alarms_reminders (
        id TEXT PRIMARY KEY,
        time TEXT NOT NULL,
        title TEXT NOT NULL,
        repeat TEXT,
        enabled INTEGER,
        is_ai INTEGER,
        sound_enabled INTEGER,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS profile_state (
        id TEXT PRIMARY KEY,
        name TEXT,
        mode TEXT,
        calorie_target INTEGER,
        protein_target INTEGER,
        sleep_target REAL,
        steps_target INTEGER,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS coach_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        role TEXT,
        content TEXT,
        timestamp TEXT
      );

      CREATE TABLE IF NOT EXISTS coach_memories (
        id TEXT PRIMARY KEY,
        category TEXT,
        key_fact TEXT,
        source TEXT,
        confidence REAL,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS offline_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        payload TEXT NOT NULL,
        queued_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS daily_health_metrics (
        date TEXT PRIMARY KEY,
        overall_score REAL NOT NULL,
        steps INTEGER DEFAULT 0,
        active_calories REAL DEFAULT 0,
        distance_km REAL DEFAULT 0,
        nutrition_score REAL DEFAULT 0,
        calories_consumed REAL DEFAULT 0,
        protein_grams REAL DEFAULT 0,
        carbs_grams REAL DEFAULT 0,
        fat_grams REAL DEFAULT 0,
        sleep_score REAL DEFAULT 0,
        sleep_hours REAL DEFAULT 0,
        sleep_quality TEXT DEFAULT 'Normal',
        hydration_score REAL DEFAULT 0,
        hydration_ml INTEGER DEFAULT 0,
        hydration_cups INTEGER DEFAULT 0,
        screen_score REAL DEFAULT 0,
        screen_minutes INTEGER DEFAULT 0,
        ai_insights_json TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      DELETE FROM workouts WHERE id = 'w-001' OR (duration_minutes <= 1 AND calories_burned <= 12);
    `);

    isDbInitialized = true;
    await seedDefaultDataIfNeeded();
  } catch (err) {
    console.warn("SQLite master initialization warning (falling back to hybrid storage):", err);
    return null;
  }

  return nativeDbInstance;
}

// Seed baseline defaults if DB is fresh
async function seedDefaultDataIfNeeded() {
  const profile = await getProfileState();
  if (!profile) {
    await saveProfileState({
      id: "primary",
      name: "User",
      mode: "standard",
      dailyCalorieTarget: 2100,
      dailyProteinTarget: 110,
      dailySleepTargetHours: 8.0,
      dailyStepsTarget: 9000,
      updatedAt: new Date().toISOString(),
    });
  }

  // Initial coach welcome message if chat empty
  const msgs = await getCoachMessages();
  if (msgs.length === 0) {
    await saveCoachMessage({
      id: "msg-welcome",
      conversationId: "1",
      role: "assistant",
      content:
        "Hello! I am Lumen Coach, your personalized bio-intelligence advisor. My Memory Engine is actively synchronized with your Nutrition, Sleep, Activity, and Screen Time telemetry. How can I assist you today?",
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// 1. ROBUST UNLIMITED KEY-VALUE STORE (Backs storage.ts)
// ============================================================================

export async function getKV(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return store[key] !== undefined ? String(store[key]) : null;
  }

  try {
    const row: any = await db.getFirstAsync(
      `SELECT value FROM kv_store WHERE key = ?`,
      key
    );
    return row ? row.value : null;
  } catch (err) {
    console.warn("getKV error:", err);
    const store = getWebStore();
    return store[key] !== undefined ? String(store[key]) : null;
  }
}

export async function setKV(key: string, value: string): Promise<void> {
  const db = await getDb();
  // Always mirror in web/localStorage store for resilience
  const store = getWebStore();
  store[key] = value;
  saveWebStore(store);

  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      key,
      value
    );
  } catch (err) {
    console.warn("setKV SQLite error (saved to persistent mirror):", err);
  }
}

export async function deleteKV(key: string): Promise<void> {
  const db = await getDb();
  const store = getWebStore();
  delete store[key];
  saveWebStore(store);

  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM kv_store WHERE key = ?`, key);
  } catch (err) {
    console.warn("deleteKV error:", err);
  }
}

export async function getAllKVKeys(): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    return Object.keys(getWebStore());
  }
  try {
    const rows: any[] = await db.getAllAsync(`SELECT key FROM kv_store`);
    return rows.map((r) => r.key);
  } catch {
    return Object.keys(getWebStore());
  }
}

// ============================================================================
// 2. MEALS & NUTRITION ENGINE
// ============================================================================

export async function getMeals(): Promise<MealRecord[]> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return Array.isArray(store.meals_table) ? store.meals_table : [];
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM meals ORDER BY logged_at DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      mealType: r.meal_type,
      calories: Number(r.calories),
      proteinGrams: Number(r.protein_grams),
      carbsGrams: Number(r.carbs_grams),
      fatGrams: Number(r.fat_grams),
      vitamins: r.vitamins,
      items: r.items_json ? JSON.parse(r.items_json) : [],
      photoUrl: r.photo_url,
      source: r.source,
      loggedAt: r.logged_at,
    }));
  } catch (err) {
    console.warn("getMeals error:", err);
    const store = getWebStore();
    return Array.isArray(store.meals_table) ? store.meals_table : [];
  }
}

export async function saveMeal(meal: MealRecord): Promise<void> {
  // Mirror to web
  const store = getWebStore();
  const list: MealRecord[] = Array.isArray(store.meals_table) ? store.meals_table : [];
  const updated = [meal, ...list.filter((m) => m.id !== meal.id)];
  store.meals_table = updated;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO meals (id, name, meal_type, calories, protein_grams, carbs_grams, fat_grams, vitamins, items_json, photo_url, source, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         meal_type = excluded.meal_type,
         calories = excluded.calories,
         protein_grams = excluded.protein_grams,
         carbs_grams = excluded.carbs_grams,
         fat_grams = excluded.fat_grams,
         vitamins = excluded.vitamins,
         items_json = excluded.items_json,
         photo_url = excluded.photo_url,
         source = excluded.source,
         logged_at = excluded.logged_at`,
      meal.id,
      meal.name,
      meal.mealType,
      meal.calories,
      meal.proteinGrams,
      meal.carbsGrams,
      meal.fatGrams,
      meal.vitamins || null,
      meal.items ? JSON.stringify(meal.items) : null,
      meal.photoUrl || null,
      meal.source || "manual",
      meal.loggedAt
    );
  } catch (err) {
    console.warn("saveMeal error:", err);
  }
}

export async function deleteMeal(id: string): Promise<void> {
  const store = getWebStore();
  if (Array.isArray(store.meals_table)) {
    store.meals_table = store.meals_table.filter((m: MealRecord) => m.id !== id);
    saveWebStore(store);
  }
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM meals WHERE id = ?`, id);
  } catch (err) {
    console.warn("deleteMeal error:", err);
  }
}

// ============================================================================
// 3. WORKOUTS & ACTIVITY ENGINE
// ============================================================================

export async function getWorkouts(): Promise<WorkoutRecord[]> {
  const filterValid = (list: WorkoutRecord[]) =>
    list.filter((w) => w.id !== "w-001" && !(w.durationMinutes <= 1 && w.caloriesBurned <= 12));

  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return filterValid(Array.isArray(store.workouts_table) ? store.workouts_table : []);
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM workouts ORDER BY logged_at DESC`
    );
    const parsed = rows.map((r) => ({
      id: r.id,
      type: r.type,
      durationMinutes: Number(r.duration_minutes),
      caloriesBurned: Number(r.calories_burned),
      steps: r.steps ? Number(r.steps) : undefined,
      distanceKm: r.distance_km ? Number(r.distance_km) : undefined,
      avgHeartRate: r.avg_heart_rate ? Number(r.avg_heart_rate) : undefined,
      intensity: r.intensity,
      notes: r.notes,
      loggedAt: r.logged_at,
    }));
    return filterValid(parsed);
  } catch (err) {
    console.warn("getWorkouts error:", err);
    const store = getWebStore();
    return filterValid(Array.isArray(store.workouts_table) ? store.workouts_table : []);
  }
}

export async function saveWorkout(workout: WorkoutRecord): Promise<void> {
  const store = getWebStore();
  const list: WorkoutRecord[] = Array.isArray(store.workouts_table) ? store.workouts_table : [];
  const updated = [workout, ...list.filter((w) => w.id !== workout.id)];
  store.workouts_table = updated;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO workouts (id, type, duration_minutes, calories_burned, steps, distance_km, avg_heart_rate, intensity, notes, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         duration_minutes = excluded.duration_minutes,
         calories_burned = excluded.calories_burned,
         steps = excluded.steps,
         distance_km = excluded.distance_km,
         avg_heart_rate = excluded.avg_heart_rate,
         intensity = excluded.intensity,
         notes = excluded.notes,
         logged_at = excluded.logged_at`,
      workout.id,
      workout.type,
      workout.durationMinutes,
      workout.caloriesBurned,
      workout.steps || null,
      workout.distanceKm || null,
      workout.avgHeartRate || null,
      workout.intensity || "moderate",
      workout.notes || null,
      workout.loggedAt
    );
  } catch (err) {
    console.warn("saveWorkout error:", err);
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  const store = getWebStore();
  if (Array.isArray(store.workouts_table)) {
    store.workouts_table = store.workouts_table.filter((w: WorkoutRecord) => w.id !== id);
    saveWebStore(store);
  }
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM workouts WHERE id = ?`, id);
  } catch (err) {
    console.warn("deleteWorkout error:", err);
  }
}

// ============================================================================
// 4. SLEEP SESSIONS & RECOVERY ENGINE
// ============================================================================

export async function getSleepSessions(): Promise<SleepRecord[]> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return Array.isArray(store.sleep_table) ? store.sleep_table : [];
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM sleep_sessions ORDER BY logged_at DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      durationHours: Number(r.duration_hours),
      quality: r.quality,
      deepSleepHours: r.deep_sleep_hours ? Number(r.deep_sleep_hours) : undefined,
      remSleepHours: r.rem_sleep_hours ? Number(r.rem_sleep_hours) : undefined,
      bedtime: r.bedtime,
      wakeTime: r.wake_time,
      notes: r.notes,
      loggedAt: r.logged_at,
    }));
  } catch (err) {
    console.warn("getSleepSessions error:", err);
    const store = getWebStore();
    return Array.isArray(store.sleep_table) ? store.sleep_table : [];
  }
}

export const getSleepRecords = getSleepSessions;

export async function getLatestSleep(): Promise<SleepRecord | null> {
  const sessions = await getSleepSessions();
  return sessions.length > 0 ? sessions[0] : null;
}

export async function saveSleepSession(session: SleepRecord): Promise<void> {
  const store = getWebStore();
  const list: SleepRecord[] = Array.isArray(store.sleep_table) ? store.sleep_table : [];
  const updated = [session, ...list.filter((s) => s.id !== session.id)];
  store.sleep_table = updated;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO sleep_sessions (id, duration_hours, quality, deep_sleep_hours, rem_sleep_hours, bedtime, wake_time, notes, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         duration_hours = excluded.duration_hours,
         quality = excluded.quality,
         deep_sleep_hours = excluded.deep_sleep_hours,
         rem_sleep_hours = excluded.rem_sleep_hours,
         bedtime = excluded.bedtime,
         wake_time = excluded.wake_time,
         notes = excluded.notes,
         logged_at = excluded.logged_at`,
      session.id,
      session.durationHours,
      session.quality,
      session.deepSleepHours || null,
      session.remSleepHours || null,
      session.bedtime || null,
      session.wakeTime || null,
      session.notes || null,
      session.loggedAt
    );
  } catch (err) {
    console.warn("saveSleepSession error:", err);
  }
}

// ============================================================================
// 5. HYDRATION ENGINE
// ============================================================================

export async function getHydrationToday(): Promise<number> {
  const db = await getDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  if (!db) {
    const store = getWebStore();
    return Number(store[`hydration_${todayStr}`] || 0);
  }

  try {
    const row: any = await db.getFirstAsync(
      `SELECT cups FROM hydration_logs WHERE id = ?`,
      `hyd-${todayStr}`
    );
    return row ? Number(row.cups) : 0;
  } catch {
    const store = getWebStore();
    return Number(store[`hydration_${todayStr}`] || 0);
  }
}

export async function setHydrationToday(cups: number): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const store = getWebStore();
  store[`hydration_${todayStr}`] = cups;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO hydration_logs (id, cups, amount_ml, logged_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET cups = excluded.cups, amount_ml = excluded.amount_ml`,
      `hyd-${todayStr}`,
      cups,
      cups * 250
    );
  } catch (err) {
    console.warn("setHydrationToday error:", err);
  }
}

export interface HydrationEntryRecord {
  id: string;
  amountMl: number;
  beverageType: string;
  loggedAt: string;
}

export async function addHydrationEntry(entry: HydrationEntryRecord): Promise<void> {
  const store = getWebStore();
  const entries: HydrationEntryRecord[] = store["hydration_entries"] || [];
  entries.push(entry);
  store["hydration_entries"] = entries;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO hydration_entries (id, amount_ml, beverage_type, logged_at) VALUES (?, ?, ?, ?)`,
      entry.id,
      entry.amountMl,
      entry.beverageType,
      entry.loggedAt
    );
  } catch (err) {
    console.warn("addHydrationEntry error:", err);
  }
}

export async function getHydrationEntriesToday(): Promise<HydrationEntryRecord[]> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const db = await getDb();

  if (!db) {
    const store = getWebStore();
    const entries: HydrationEntryRecord[] = store["hydration_entries"] || [];
    return entries.filter((e) => (e.loggedAt || "").startsWith(todayStr));
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT id, amount_ml as amountMl, beverage_type as beverageType, logged_at as loggedAt
       FROM hydration_entries
       WHERE logged_at LIKE ?
       ORDER BY logged_at ASC`,
      `${todayStr}%`
    );
    return rows || [];
  } catch {
    const store = getWebStore();
    const entries: HydrationEntryRecord[] = store["hydration_entries"] || [];
    return entries.filter((e) => (e.loggedAt || "").startsWith(todayStr));
  }
}

export async function deleteHydrationEntry(id: string): Promise<void> {
  const store = getWebStore();
  const entries: HydrationEntryRecord[] = store["hydration_entries"] || [];
  store["hydration_entries"] = entries.filter((e) => e.id !== id);
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(`DELETE FROM hydration_entries WHERE id = ?`, id);
  } catch (err) {
    console.warn("deleteHydrationEntry error:", err);
  }
}

// ============================================================================
// 6. SCREEN TIME & DIGITAL WELLBEING ENGINE
// ============================================================================

export async function getScreenTimeToday(): Promise<ScreenTimeRecord> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultRecord: ScreenTimeRecord = {
    id: `screen-${todayStr}`,
    screenMinutes: 0,
    limitMinutes: 240,
    productivityMinutes: 0,
    socialMinutes: 0,
    mediaMinutes: 0,
    wellbeingMinutes: 0,
    focusMode: false,
    windDown: false,
    loggedAt: new Date().toISOString(),
  };

  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return store[`screentime_${todayStr}`] || defaultRecord;
  }

  try {
    const row: any = await db.getFirstAsync(
      `SELECT * FROM screentime_logs WHERE id = ?`,
      `screen-${todayStr}`
    );
    if (!row) return defaultRecord;
    return {
      id: row.id,
      screenMinutes: Number(row.screen_minutes),
      limitMinutes: Number(row.limit_minutes),
      productivityMinutes: Number(row.productivity_minutes),
      socialMinutes: Number(row.social_minutes),
      mediaMinutes: Number(row.media_minutes),
      wellbeingMinutes: Number(row.wellbeing_minutes),
      focusMode: Boolean(row.focus_mode),
      windDown: Boolean(row.wind_down),
      loggedAt: row.logged_at,
    };
  } catch {
    const store = getWebStore();
    return store[`screentime_${todayStr}`] || defaultRecord;
  }
}

export async function saveScreenTime(st: ScreenTimeRecord): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const store = getWebStore();
  store[`screentime_${todayStr}`] = st;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO screentime_logs (id, screen_minutes, limit_minutes, productivity_minutes, social_minutes, media_minutes, wellbeing_minutes, focus_mode, wind_down, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         screen_minutes = excluded.screen_minutes,
         limit_minutes = excluded.limit_minutes,
         productivity_minutes = excluded.productivity_minutes,
         social_minutes = excluded.social_minutes,
         media_minutes = excluded.media_minutes,
         wellbeing_minutes = excluded.wellbeing_minutes,
         focus_mode = excluded.focus_mode,
         wind_down = excluded.wind_down,
         logged_at = excluded.logged_at`,
      st.id,
      st.screenMinutes,
      st.limitMinutes,
      st.productivityMinutes,
      st.socialMinutes,
      st.mediaMinutes,
      st.wellbeingMinutes,
      st.focusMode ? 1 : 0,
      st.windDown ? 1 : 0,
      st.loggedAt
    );
  } catch (err) {
    console.warn("saveScreenTime error:", err);
  }
}

export async function getScreenTimeRecords(): Promise<ScreenTimeRecord[]> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    const results: ScreenTimeRecord[] = [];
    for (const key of Object.keys(store)) {
      if (key.startsWith("screentime_") && store[key]) {
        results.push(store[key]);
      }
    }
    return results;
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM screentime_logs ORDER BY logged_at DESC LIMIT 50`
    );
    return rows.map((row: any) => ({
      id: row.id,
      screenMinutes: Number(row.screen_minutes),
      limitMinutes: Number(row.limit_minutes),
      productivityMinutes: Number(row.productivity_minutes),
      socialMinutes: Number(row.social_minutes),
      mediaMinutes: Number(row.media_minutes),
      wellbeingMinutes: Number(row.wellbeing_minutes),
      focusMode: Boolean(row.focus_mode),
      windDown: Boolean(row.wind_down),
      loggedAt: row.logged_at,
    }));
  } catch (err) {
    console.warn("getScreenTimeRecords error:", err);
    return [];
  }
}

export async function saveFocusSession(session: FocusSessionRecord): Promise<void> {
  const store = getWebStore();
  const existing = Array.isArray(store.focus_sessions) ? store.focus_sessions : [];
  const updated = [session, ...existing.filter((s: any) => s.id !== session.id)];
  store.focus_sessions = updated;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO focus_sessions (id, session_type, target_minutes, completed_seconds, status, distracting_apps, reflection_score, reflection_note, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         session_type = excluded.session_type,
         target_minutes = excluded.target_minutes,
         completed_seconds = excluded.completed_seconds,
         status = excluded.status,
         distracting_apps = excluded.distracting_apps,
         reflection_score = excluded.reflection_score,
         reflection_note = excluded.reflection_note,
         started_at = excluded.started_at,
         ended_at = excluded.ended_at`,
      session.id,
      session.sessionType,
      session.targetMinutes,
      session.completedSeconds,
      session.status,
      JSON.stringify(session.distractingAppsBlocked || []),
      session.reflectionScore ?? null,
      session.reflectionNote ?? null,
      session.startedAt,
      session.endedAt ?? null
    );
  } catch (err) {
    console.warn("saveFocusSession error:", err);
  }
}

export async function getFocusSessionsToday(): Promise<FocusSessionRecord[]> {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    const sessions = Array.isArray(store.focus_sessions) ? store.focus_sessions : [];
    return sessions.filter((s: any) => s.startedAt?.startsWith(todayPrefix));
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM focus_sessions WHERE started_at LIKE ? ORDER BY started_at DESC`,
      `${todayPrefix}%`
    );
    return rows.map((r) => ({
      id: r.id,
      sessionType: r.session_type,
      targetMinutes: Number(r.target_minutes),
      completedSeconds: Number(r.completed_seconds),
      status: r.status,
      distractingAppsBlocked: r.distracting_apps ? JSON.parse(r.distracting_apps) : [],
      reflectionScore: r.reflection_score != null ? Number(r.reflection_score) : undefined,
      reflectionNote: r.reflection_note || undefined,
      startedAt: r.started_at,
      endedAt: r.ended_at || undefined,
    }));
  } catch (err) {
    const store = getWebStore();
    const sessions = Array.isArray(store.focus_sessions) ? store.focus_sessions : [];
    return sessions.filter((s: any) => s.startedAt?.startsWith(todayPrefix));
  }
}

export async function getFocusSessionHistory(limit = 20): Promise<FocusSessionRecord[]> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return Array.isArray(store.focus_sessions) ? store.focus_sessions.slice(0, limit) : [];
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM focus_sessions ORDER BY started_at DESC LIMIT ?`,
      limit
    );
    return rows.map((r) => ({
      id: r.id,
      sessionType: r.session_type,
      targetMinutes: Number(r.target_minutes),
      completedSeconds: Number(r.completed_seconds),
      status: r.status,
      distractingAppsBlocked: r.distracting_apps ? JSON.parse(r.distracting_apps) : [],
      reflectionScore: r.reflection_score != null ? Number(r.reflection_score) : undefined,
      reflectionNote: r.reflection_note || undefined,
      startedAt: r.started_at,
      endedAt: r.ended_at || undefined,
    }));
  } catch {
    const store = getWebStore();
    return Array.isArray(store.focus_sessions) ? store.focus_sessions.slice(0, limit) : [];
  }
}

export async function getWellbeingConfig(): Promise<WellbeingConfigRecord> {
  const defaultConfig: WellbeingConfigRecord = {
    dailyLimitMinutes: 240,
    windDownEnabled: true,
    windDownBedtime: "22:30",
    windDownWakeup: "07:00",
    blockedCategories: ["social", "video", "games"],
    dndAutoToggle: true,
  };

  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return store.wellbeing_config || defaultConfig;
  }

  try {
    const row: any = await db.getFirstAsync(
      `SELECT * FROM wellbeing_config WHERE id = ?`,
      "primary"
    );
    if (!row) return defaultConfig;
    return {
      dailyLimitMinutes: Number(row.daily_limit_minutes),
      windDownEnabled: Boolean(row.wind_down_enabled),
      windDownBedtime: row.wind_down_bedtime || "22:30",
      windDownWakeup: row.wind_down_wakeup || "07:00",
      blockedCategories: row.blocked_categories ? JSON.parse(row.blocked_categories) : defaultConfig.blockedCategories,
      dndAutoToggle: Boolean(row.dnd_auto_toggle),
    };
  } catch {
    const store = getWebStore();
    return store.wellbeing_config || defaultConfig;
  }
}

export async function saveWellbeingConfig(cfg: WellbeingConfigRecord): Promise<void> {
  const store = getWebStore();
  store.wellbeing_config = cfg;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO wellbeing_config (id, daily_limit_minutes, wind_down_enabled, wind_down_bedtime, wind_down_wakeup, blocked_categories, dnd_auto_toggle)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         daily_limit_minutes = excluded.daily_limit_minutes,
         wind_down_enabled = excluded.wind_down_enabled,
         wind_down_bedtime = excluded.wind_down_bedtime,
         wind_down_wakeup = excluded.wind_down_wakeup,
         blocked_categories = excluded.blocked_categories,
         dnd_auto_toggle = excluded.dnd_auto_toggle`,
      "primary",
      cfg.dailyLimitMinutes,
      cfg.windDownEnabled ? 1 : 0,
      cfg.windDownBedtime,
      cfg.windDownWakeup,
      JSON.stringify(cfg.blockedCategories),
      cfg.dndAutoToggle ? 1 : 0
    );
  } catch (err) {
    console.warn("saveWellbeingConfig error:", err);
  }
}

// ============================================================================
// 7. ALARMS & REMINDERS ENGINE
// ============================================================================

export async function getAlarms(): Promise<AlarmRecord[]> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return Array.isArray(store.alarms_table) ? store.alarms_table : [];
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM alarms_reminders ORDER BY time ASC`
    );
    return rows.map((r) => ({
      id: r.id,
      time: r.time,
      title: r.title,
      repeat: r.repeat,
      enabled: Boolean(r.enabled),
      isAi: Boolean(r.is_ai),
      soundEnabled: Boolean(r.sound_enabled),
      createdAt: r.created_at,
    }));
  } catch {
    const store = getWebStore();
    return Array.isArray(store.alarms_table) ? store.alarms_table : [];
  }
}

export async function saveAlarm(alarm: AlarmRecord): Promise<void> {
  const store = getWebStore();
  const list: AlarmRecord[] = Array.isArray(store.alarms_table) ? store.alarms_table : [];
  const updated = [alarm, ...list.filter((a) => a.id !== alarm.id)];
  store.alarms_table = updated;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO alarms_reminders (id, time, title, repeat, enabled, is_ai, sound_enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         time = excluded.time,
         title = excluded.title,
         repeat = excluded.repeat,
         enabled = excluded.enabled,
         is_ai = excluded.is_ai,
         sound_enabled = excluded.sound_enabled`,
      alarm.id,
      alarm.time,
      alarm.title,
      alarm.repeat,
      alarm.enabled ? 1 : 0,
      alarm.isAi ? 1 : 0,
      alarm.soundEnabled ? 1 : 0,
      alarm.createdAt
    );
  } catch (err) {
    console.warn("saveAlarm error:", err);
  }
}

export async function deleteAlarm(id: string): Promise<void> {
  const store = getWebStore();
  if (Array.isArray(store.alarms_table)) {
    store.alarms_table = store.alarms_table.filter((a: AlarmRecord) => a.id !== id);
    saveWebStore(store);
  }
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM alarms_reminders WHERE id = ?`, id);
  } catch (err) {
    console.warn("deleteAlarm error:", err);
  }
}

// ============================================================================
// 8. LUMEN COACH MESSAGES & CONVERSATION HISTORY
// ============================================================================

export async function getCoachMessages(conversationId: string = "1"): Promise<CoachMessageRecord[]> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    const list: CoachMessageRecord[] = Array.isArray(store.coach_messages) ? store.coach_messages : [];
    return list.filter((m) => m.conversationId === conversationId);
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM coach_messages WHERE conversation_id = ? ORDER BY timestamp ASC`,
      conversationId
    );
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role as "user" | "assistant",
      content: r.content,
      timestamp: r.timestamp,
    }));
  } catch (err) {
    console.warn("getCoachMessages error:", err);
    const store = getWebStore();
    return Array.isArray(store.coach_messages) ? store.coach_messages : [];
  }
}

export async function saveCoachMessage(msg: CoachMessageRecord): Promise<void> {
  const store = getWebStore();
  const list: CoachMessageRecord[] = Array.isArray(store.coach_messages) ? store.coach_messages : [];
  const updated = [...list.filter((m) => m.id !== msg.id), msg];
  store.coach_messages = updated;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO coach_messages (id, conversation_id, role, content, timestamp)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET content = excluded.content, timestamp = excluded.timestamp`,
      msg.id,
      msg.conversationId,
      msg.role,
      msg.content,
      msg.timestamp
    );
  } catch (err) {
    console.warn("saveCoachMessage error:", err);
  }
}

export async function clearCoachMessages(conversationId: string = "1"): Promise<void> {
  const store = getWebStore();
  if (Array.isArray(store.coach_messages)) {
    store.coach_messages = store.coach_messages.filter((m: CoachMessageRecord) => m.conversationId !== conversationId);
    saveWebStore(store);
  }
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM coach_messages WHERE conversation_id = ?`, conversationId);
  } catch (err) {
    console.warn("clearCoachMessages error:", err);
  }
}

// ============================================================================
// 9. LUMEN COACH MEMORY ENGINE (Long-Term Vector/Fact Store)
// ============================================================================

export async function getCoachMemories(): Promise<CoachMemoryRecord[]> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return Array.isArray(store.coach_memories) ? store.coach_memories : [];
  }

  try {
    const rows: any[] = await db.getAllAsync(
      `SELECT * FROM coach_memories ORDER BY created_at DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      category: r.category as any,
      keyFact: r.key_fact,
      source: r.source as any,
      confidence: Number(r.confidence),
      createdAt: r.created_at,
    }));
  } catch {
    const store = getWebStore();
    return Array.isArray(store.coach_memories) ? store.coach_memories : [];
  }
}

export async function saveCoachMemory(mem: CoachMemoryRecord): Promise<void> {
  const store = getWebStore();
  const list: CoachMemoryRecord[] = Array.isArray(store.coach_memories) ? store.coach_memories : [];
  const updated = [mem, ...list.filter((m) => m.id !== mem.id)];
  store.coach_memories = updated;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO coach_memories (id, category, key_fact, source, confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         category = excluded.category,
         key_fact = excluded.key_fact,
         confidence = excluded.confidence`,
      mem.id,
      mem.category,
      mem.keyFact,
      mem.source,
      mem.confidence,
      mem.createdAt
    );
  } catch (err) {
    console.warn("saveCoachMemory error:", err);
  }
}

export async function deleteCoachMemory(id: string): Promise<void> {
  const store = getWebStore();
  if (Array.isArray(store.coach_memories)) {
    store.coach_memories = store.coach_memories.filter((m: CoachMemoryRecord) => m.id !== id);
    saveWebStore(store);
  }
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM coach_memories WHERE id = ?`, id);
  } catch (err) {
    console.warn("deleteCoachMemory error:", err);
  }
}

// ============================================================================
// 10. PROFILE & GOALS STATE
// ============================================================================

export async function getProfileState(): Promise<ProfileRecord | null> {
  const db = await getDb();
  if (!db) {
    const store = getWebStore();
    return store.profile_state || null;
  }

  try {
    const row: any = await db.getFirstAsync(
      `SELECT * FROM profile_state WHERE id = ?`,
      "primary"
    );
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      mode: row.mode,
      dailyCalorieTarget: Number(row.calorie_target),
      dailyProteinTarget: Number(row.protein_target),
      dailySleepTargetHours: Number(row.sleep_target),
      dailyStepsTarget: Number(row.steps_target),
      updatedAt: row.updated_at,
    };
  } catch {
    const store = getWebStore();
    return store.profile_state || null;
  }
}

export async function saveProfileState(p: ProfileRecord): Promise<void> {
  const store = getWebStore();
  store.profile_state = p;
  saveWebStore(store);

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO profile_state (id, name, mode, calorie_target, protein_target, sleep_target, steps_target, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         mode = excluded.mode,
         calorie_target = excluded.calorie_target,
         protein_target = excluded.protein_target,
         sleep_target = excluded.sleep_target,
         steps_target = excluded.steps_target,
         updated_at = excluded.updated_at`,
      "primary",
      p.name,
      p.mode,
      p.dailyCalorieTarget,
      p.dailyProteinTarget,
      p.dailySleepTargetHours,
      p.dailyStepsTarget,
      p.updatedAt
    );
  } catch (err) {
    console.warn("saveProfileState error:", err);
  }
}

// ============================================================================
// 11. OFFLINE SYNC QUEUE (Preserved for backend synchronization)
// ============================================================================

export async function queueOfflineLog(category: string, endpoint: string, payload: any) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(
      `INSERT INTO offline_logs (category, endpoint, payload) VALUES (?, ?, ?)`,
      category,
      endpoint,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.warn("queueOfflineLog error:", err);
  }
}

export async function getPendingLogs(): Promise<OfflineLog[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db.getAllAsync(`SELECT * FROM offline_logs ORDER BY id ASC`);
    return rows as OfflineLog[];
  } catch {
    return [];
  }
}

export async function deleteOfflineLog(id: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM offline_logs WHERE id = ?`, id);
  } catch (err) {
    console.warn("deleteOfflineLog error:", err);
  }
}

// ============================================================================
// 12. DAILY HEALTH METRICS & BIOMETRIC ANALYTICS (Persistent Snapshot Engine)
// ============================================================================

export async function saveDailyHealthRecord(record: DailyHealthRecord): Promise<void> {
  if (Platform.OS === "web") {
    const store = getWebStore();
    store.daily_health_metrics = store.daily_health_metrics || {};
    store.daily_health_metrics[record.date] = { ...record };
    saveWebStore(store);
    return;
  }

  const db = await getDb();
  if (!db) return;

  try {
    await db.runAsync(
      `INSERT INTO daily_health_metrics (
        date, overall_score, steps, active_calories, distance_km,
        nutrition_score, calories_consumed, protein_grams, carbs_grams, fat_grams,
        sleep_score, sleep_hours, sleep_quality,
        hydration_score, hydration_ml, hydration_cups,
        screen_score, screen_minutes, ai_insights_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        overall_score = excluded.overall_score,
        steps = excluded.steps,
        active_calories = excluded.active_calories,
        distance_km = excluded.distance_km,
        nutrition_score = excluded.nutrition_score,
        calories_consumed = excluded.calories_consumed,
        protein_grams = excluded.protein_grams,
        carbs_grams = excluded.carbs_grams,
        fat_grams = excluded.fat_grams,
        sleep_score = excluded.sleep_score,
        sleep_hours = excluded.sleep_hours,
        sleep_quality = excluded.sleep_quality,
        hydration_score = excluded.hydration_score,
        hydration_ml = excluded.hydration_ml,
        hydration_cups = excluded.hydration_cups,
        screen_score = excluded.screen_score,
        screen_minutes = excluded.screen_minutes,
        ai_insights_json = excluded.ai_insights_json,
        updated_at = excluded.updated_at`,
      record.date,
      record.overallScore,
      record.steps || 0,
      record.activeCalories || 0,
      record.distanceKm || 0,
      record.nutritionScore || 0,
      record.caloriesConsumed || 0,
      record.proteinGrams || 0,
      record.carbsGrams || 0,
      record.fatGrams || 0,
      record.sleepScore || 0,
      record.sleepHours || 0,
      record.sleepQuality || "Normal",
      record.hydrationScore || 0,
      record.hydrationMl || 0,
      record.hydrationCups || 0,
      record.screenScore || 0,
      record.screenMinutes || 0,
      record.aiInsightsJson || null,
      record.updatedAt || new Date().toISOString()
    );
  } catch (err) {
    console.warn("saveDailyHealthRecord error:", err);
  }
}

export async function getDailyHealthRecord(date: string): Promise<DailyHealthRecord | null> {
  if (Platform.OS === "web") {
    const store = getWebStore();
    return store.daily_health_metrics?.[date] || null;
  }

  const db = await getDb();
  if (!db) return null;

  try {
    const row = await db.getFirstAsync(
      `SELECT * FROM daily_health_metrics WHERE date = ?`,
      date
    );
    if (!row) return null;
    return mapDbRowToDailyRecord(row);
  } catch (err) {
    console.warn("getDailyHealthRecord error:", err);
    return null;
  }
}

export async function getAllDailyHealthRecords(): Promise<DailyHealthRecord[]> {
  if (Platform.OS === "web") {
    const store = getWebStore();
    const metricsMap = store.daily_health_metrics || {};
    return Object.values(metricsMap).sort((a: any, b: any) => a.date.localeCompare(b.date)) as DailyHealthRecord[];
  }

  const db = await getDb();
  if (!db) return [];

  try {
    const rows = await db.getAllAsync(
      `SELECT * FROM daily_health_metrics ORDER BY date ASC`
    );
    return rows.map(mapDbRowToDailyRecord);
  } catch (err) {
    console.warn("getAllDailyHealthRecords error:", err);
    return [];
  }
}

export async function getDailyHealthRecordsForRange(startDate: string, endDate: string): Promise<DailyHealthRecord[]> {
  if (Platform.OS === "web") {
    const store = getWebStore();
    const metricsMap = store.daily_health_metrics || {};
    return (Object.values(metricsMap) as DailyHealthRecord[])
      .filter(r => r.date >= startDate && r.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const db = await getDb();
  if (!db) return [];

  try {
    const rows = await db.getAllAsync(
      `SELECT * FROM daily_health_metrics WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      startDate,
      endDate
    );
    return rows.map(mapDbRowToDailyRecord);
  } catch (err) {
    console.warn("getDailyHealthRecordsForRange error:", err);
    return [];
  }
}

export async function getDailyHealthRecordsForMonth(year: number, month: number): Promise<DailyHealthRecord[]> {
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const startDate = `${monthStr}-01`;
  const endDate = `${monthStr}-31`;
  return getDailyHealthRecordsForRange(startDate, endDate);
}

export async function clearAllDailyHealthRecords(): Promise<void> {
  if (Platform.OS === "web") {
    const store = getWebStore();
    store.daily_health_metrics = {};
    saveWebStore(store);
    return;
  }
  const db = await getDb();
  if (!db) return;
  try {
    await db.runAsync(`DELETE FROM daily_health_metrics`);
  } catch (err) {
    console.warn("clearAllDailyHealthRecords error:", err);
  }
}

function mapDbRowToDailyRecord(r: any): DailyHealthRecord {
  return {
    date: r.date,
    overallScore: Number(r.overall_score || 0),
    steps: Number(r.steps || 0),
    activeCalories: Number(r.active_calories || 0),
    distanceKm: Number(r.distance_km || 0),
    nutritionScore: Number(r.nutrition_score || 0),
    caloriesConsumed: Number(r.calories_consumed || 0),
    proteinGrams: Number(r.protein_grams || 0),
    carbsGrams: Number(r.carbs_grams || 0),
    fatGrams: Number(r.fat_grams || 0),
    sleepScore: Number(r.sleep_score || 0),
    sleepHours: Number(r.sleep_hours || 0),
    sleepQuality: r.sleep_quality || "Normal",
    hydrationScore: Number(r.hydration_score || 0),
    hydrationMl: Number(r.hydration_ml || 0),
    hydrationCups: Number(r.hydration_cups || 0),
    screenScore: Number(r.screen_score || 0),
    screenMinutes: Number(r.screen_minutes || 0),
    aiInsightsJson: r.ai_insights_json || undefined,
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}
