import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { CompleteOnboardingBody } from "@workspace/api-zod";
import { getOrCreateProfile, profileToApi } from "../lib/store";

const router: IRouter = Router();

router.post("/onboarding/complete", async (req, res): Promise<void> => {
  const parsed = CompleteOnboardingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();
  const update: Record<string, unknown> = {
    onboardingComplete: true,
    name: parsed.data.name,
    mode: parsed.data.mode,
  };
  const optional = [
    "dailyCalorieTarget",
    "dailyProteinTarget",
    "dailyStepsTarget",
    "dailyScreenTimeLimitMinutes",
    "glucoseTargetLow",
    "glucoseTargetHigh",
    "dailyCarbLimit",
    "voiceEnabled",
    "motionPermissionGranted",
    "notificationsEnabled",
  ] as const;
  for (const key of optional) {
    const v = (parsed.data as Record<string, unknown>)[key];
    if (v !== undefined) update[key] = v;
  }
  if (parsed.data.dailySleepTargetHours !== undefined) {
    update["dailySleepTargetHours"] = String(parsed.data.dailySleepTargetHours);
  }
  const [updated] = await db
    .update(profilesTable)
    .set(update)
    .where(eq(profilesTable.id, profile.id))
    .returning();
  res.json(profileToApi(updated!));
});

export default router;
