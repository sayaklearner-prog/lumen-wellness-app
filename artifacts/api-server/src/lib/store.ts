import {
  db,
  profilesTable,
  conversations,
  messages,
  mealsTable,
  workoutsTable,
  sleepTable,
  screenTimeTable,
  type Profile,
  type Meal,
  type Workout,
  type SleepRow,
  type ScreenTimeRow,
} from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";

let cachedProfileId: string | null = null;

export const inMemoryProfile: Profile = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Alex Rivera",
  avatarColor: "aurora",
  mode: "standard",
  premium: false,
  dailyCalorieTarget: 2100,
  dailyProteinTarget: 110,
  dailySleepTargetHours: "8.00",
  dailyStepsTarget: 9000,
  dailyScreenTimeLimitMinutes: 180,
  glucoseTargetLow: 80,
  glucoseTargetHigh: 140,
  dailyCarbLimit: 180,
  onboardingComplete: true,
  voiceEnabled: true,
  motionPermissionGranted: false,
  notificationsEnabled: false,
  fitnessExperience: "beginner",
  primaryGoal: "general_wellness",
  allergies: [],
  medications: [],
  medicalDisclaimerAcceptedAt: null,
  premiumTier: "free",
  premiumSince: null,
  joinedAt: new Date(),
};

// In-memory fallback stores
export const inMemoryConversations: Array<{ id: number; title: string; createdAt: Date }> = [
  {
    id: 1,
    title: "Health & Vitality Coaching",
    createdAt: new Date(),
  },
];

export const inMemoryMessages: Array<{ id: number; conversationId: number; role: string; content: string; createdAt: Date }> = [
  {
    id: 1,
    conversationId: 1,
    role: "assistant",
    content: "Hello Alex! I am Lumen Coach, your personalized AI wellness companion. I've synced your daily metrics—ready to help with workouts, nutrition, or recovery. What's on your mind today?",
    createdAt: new Date(),
  },
];

export const inMemoryMeals: Array<any> = [];

export const inMemoryWorkouts: Array<any> = [];

export const inMemorySleep: Array<any> = [];

export const inMemoryScreenTime: Array<any> = [];


// Profile Accessors
export async function getOrCreateProfile(): Promise<Profile> {
  try {
    if (cachedProfileId) {
      const [row] = await db.select().from(profilesTable);
      if (row) return row;
    }
    const existing = await db.select().from(profilesTable).limit(1);
    if (existing.length > 0) {
      cachedProfileId = existing[0]!.id;
      return existing[0]!;
    }
    const [created] = await db
      .insert(profilesTable)
      .values({
        name: "Alex Rivera",
        avatarColor: "aurora",
        mode: "standard",
        premium: false,
        dailyCalorieTarget: 2100,
        dailyProteinTarget: 110,
        dailySleepTargetHours: "8.00",
        dailyStepsTarget: 9000,
        dailyScreenTimeLimitMinutes: 180,
      })
      .returning();
    cachedProfileId = created!.id;
    return created!;
  } catch (err: any) {
    return inMemoryProfile;
  }
}

export function profileToApi(row: Profile) {
  return {
    id: row.id,
    name: row.name,
    avatarColor: row.avatarColor,
    mode: row.mode,
    premium: row.premium,
    dailyCalorieTarget: row.dailyCalorieTarget,
    dailyProteinTarget: row.dailyProteinTarget,
    dailySleepTargetHours: Number(row.dailySleepTargetHours),
    dailyStepsTarget: row.dailyStepsTarget,
    dailyScreenTimeLimitMinutes: row.dailyScreenTimeLimitMinutes,
    glucoseTargetLow: row.glucoseTargetLow,
    glucoseTargetHigh: row.glucoseTargetHigh,
    dailyCarbLimit: row.dailyCarbLimit,
    onboardingComplete: row.onboardingComplete,
    voiceEnabled: row.voiceEnabled,
    motionPermissionGranted: row.motionPermissionGranted,
    notificationsEnabled: row.notificationsEnabled,
    joinedAt: (row.joinedAt instanceof Date ? row.joinedAt : new Date()).toISOString(),
  };
}

// Conversation Accessors
export async function safeGetConversations() {
  try {
    const rows = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.createdAt));
    if (rows.length > 0) return rows;
  } catch {}
  return [...inMemoryConversations].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function safeCreateConversation(title: string) {
  try {
    const [created] = await db
      .insert(conversations)
      .values({ title })
      .returning();
    if (created) return created;
  } catch {}
  const newConvo = {
    id: inMemoryConversations.length + 1,
    title,
    createdAt: new Date(),
  };
  inMemoryConversations.unshift(newConvo);
  return newConvo;
}

export async function safeGetConversation(id: number) {
  try {
    const [c] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (c) return c;
  } catch {}
  return inMemoryConversations.find((c) => c.id === id) || null;
}

export async function safeDeleteConversation(id: number) {
  try {
    await db.delete(conversations).where(eq(conversations.id, id));
  } catch {}
  const idx = inMemoryConversations.findIndex((c) => c.id === id);
  if (idx !== -1) inMemoryConversations.splice(idx, 1);
}

// Message Accessors
export async function safeGetMessages(conversationId: number) {
  try {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
    if (msgs.length > 0) return msgs;
  } catch {}
  return inMemoryMessages.filter((m) => m.conversationId === conversationId);
}

export async function safeCreateMessage(conversationId: number, role: string, content: string) {
  try {
    const [msg] = await db
      .insert(messages)
      .values({ conversationId, role, content })
      .returning();
    if (msg) return msg;
  } catch {}
  const newMsg = {
    id: inMemoryMessages.length + 1,
    conversationId,
    role,
    content,
    createdAt: new Date(),
  };
  inMemoryMessages.push(newMsg);
  return newMsg;
}

// Meals Accessors
export async function safeGetMeals(): Promise<any[]> {
  try {
    const rows = await db.select().from(mealsTable).orderBy(desc(mealsTable.loggedAt));
    if (rows.length > 0) return rows;
  } catch {}
  return inMemoryMeals;
}

export async function safeCreateMeal(mealData: any): Promise<any> {
  try {
    const [row] = await db.insert(mealsTable).values(mealData).returning();
    if (row) return row;
  } catch {}
  const created = {
    id: `m-${Date.now()}`,
    ...mealData,
    loggedAt: new Date(),
  };
  inMemoryMeals.unshift(created);
  return created;
}

export async function safeDeleteMeal(id: string): Promise<boolean> {
  try {
    await db.delete(mealsTable).where(eq(mealsTable.id, id));
  } catch {}
  const idx = inMemoryMeals.findIndex((m) => m.id === id);
  if (idx !== -1) {
    inMemoryMeals.splice(idx, 1);
    return true;
  }
  return true;
}

// Workouts Accessors
export async function safeGetWorkouts(): Promise<any[]> {
  try {
    const rows = await db.select().from(workoutsTable).orderBy(desc(workoutsTable.loggedAt));
    if (rows.length > 0) return rows;
  } catch {}
  return inMemoryWorkouts;
}

export async function safeCreateWorkout(workoutData: any): Promise<any> {
  try {
    const [row] = await db.insert(workoutsTable).values(workoutData).returning();
    if (row) return row;
  } catch {}
  const created = {
    id: `w-${Date.now()}`,
    ...workoutData,
    loggedAt: new Date(),
  };
  inMemoryWorkouts.unshift(created);
  return created;
}

export async function safeDeleteWorkout(id: string): Promise<boolean> {
  try {
    await db.delete(workoutsTable).where(eq(workoutsTable.id, id));
  } catch {}
  const idx = inMemoryWorkouts.findIndex((w) => w.id === id);
  if (idx !== -1) {
    inMemoryWorkouts.splice(idx, 1);
    return true;
  }
  return true;
}

// Sleep & Screen Accessors
export async function safeGetSleep(): Promise<any[]> {
  try {
    const rows = await db.select().from(sleepTable);
    if (rows.length > 0) return rows;
  } catch {}
  return inMemorySleep;
}

export async function safeGetScreenTime(): Promise<any[]> {
  try {
    const rows = await db.select().from(screenTimeTable);
    if (rows.length > 0) return rows;
  } catch {}
  return inMemoryScreenTime;
}
