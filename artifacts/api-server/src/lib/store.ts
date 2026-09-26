import { db, profilesTable, type Profile } from "@workspace/db";

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
    console.warn("Database query failed (offline/unreachable), serving fallback profile:", err?.message);
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
    joinedAt: row.joinedAt.toISOString(),
  };
}
