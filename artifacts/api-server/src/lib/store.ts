import { db, profilesTable, type Profile } from "@workspace/db";

let cachedProfileId: string | null = null;

export async function getOrCreateProfile(): Promise<Profile> {
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
