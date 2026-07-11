import { Router, type IRouter } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetProfileResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  TogglePremiumBody,
  TogglePremiumResponse,
} from "@workspace/api-zod";
import { getOrCreateProfile, profileToApi } from "../lib/store";

const router: IRouter = Router();

router.get("/profile", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  res.json(GetProfileResponse.parse(profileToApi(profile)));
});

router.patch("/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();
  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.dailySleepTargetHours !== undefined) {
    update.dailySleepTargetHours = String(parsed.data.dailySleepTargetHours);
  }
  const [updated] = await db
    .update(profilesTable)
    .set(update)
    .where(eq(profilesTable.id, profile.id))
    .returning();
  res.json(UpdateProfileResponse.parse(profileToApi(updated!)));
});

router.post("/profile/upgrade", async (req, res): Promise<void> => {
  const parsed = TogglePremiumBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();
  const [updated] = await db
    .update(profilesTable)
    .set({ premium: parsed.data.premium })
    .where(eq(profilesTable.id, profile.id))
    .returning();
  res.json(TogglePremiumResponse.parse(profileToApi(updated!)));
});

export default router;
