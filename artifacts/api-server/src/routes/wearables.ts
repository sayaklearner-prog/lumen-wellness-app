import { Router, type IRouter } from "express";
import { safeCreateWorkout } from "../lib/store";
import { db, sleepTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router: IRouter = Router();

export interface WearableSyncPayload {
  deviceId: string;
  deviceName: string;
  brand: string;
  model?: string;
  steps: number;
  activeCalories: number;
  totalCalories: number;
  distanceKm?: number;
  sleepDurationHours?: number;
  sleepScore?: number;
  deepSleepPercent?: number;
  remSleepPercent?: number;
  heartRate?: number;
  restingHeartRate?: number;
  hrvMs?: number;
  spo2Percent?: number;
  skinTemperatureC?: number;
  batteryLevel?: number;
  firmwareRevision?: string;
  syncedAt?: string;
}

// In-memory sync history
const wearableSyncHistory: Array<WearableSyncPayload & { id: string; syncedAt: string }> = [];

router.get("/wearables/latest", (req, res) => {
  if (wearableSyncHistory.length === 0) {
    res.json(null);
    return;
  }
  res.json(wearableSyncHistory[0]);
});

router.get("/wearables/history", (req, res) => {
  res.json(wearableSyncHistory.slice(0, 50));
});

router.post("/wearables/sync", async (req, res): Promise<void> => {
  try {
    const body: WearableSyncPayload = req.body;
    if (!body || !body.deviceId || !body.deviceName) {
      res.status(400).json({ error: "deviceId and deviceName are required" });
      return;
    }

    const record = {
      ...body,
      id: randomUUID(),
      syncedAt: body.syncedAt || new Date().toISOString(),
    };

    wearableSyncHistory.unshift(record);

    // 1. Create Workout if steps or activeCalories present
    if (body.steps > 0 || body.activeCalories > 0) {
      try {
        await safeCreateWorkout({
          type: "walk",
          durationMinutes: Math.max(30, Math.round(body.steps / 100)),
          caloriesBurned: body.activeCalories > 0 ? body.activeCalories : Math.round(body.steps * 0.04),
          steps: body.steps,
          intensity: "moderate",
          source: "sensor",
        });
      } catch (err) {
        console.warn("[WEARABLES] Workout sync notice:", err);
      }
    }

    // 2. Create Sleep record if sleep duration is present
    if (body.sleepDurationHours && body.sleepDurationHours > 0) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const deepPct = body.deepSleepPercent || 20;
        const deepHrs = (body.sleepDurationHours * (deepPct / 100)).toFixed(2);
        const quality = (body.sleepScore || 80) >= 85 ? "excellent" : (body.sleepScore || 80) >= 70 ? "good" : "fair";

        await db.insert(sleepTable).values({
          date: todayStr,
          durationHours: String(body.sleepDurationHours),
          quality: quality,
          bedtime: "23:00",
          wakeTime: "07:00",
          deepSleepHours: deepHrs,
          notes: `Synced from ${body.deviceName} (${(body.brand || "wearable").toUpperCase()}). Score: ${body.sleepScore || "N/A"}`,
        });
      } catch (err) {
        console.warn("[WEARABLES] Sleep sync notice:", err);
      }
    }

    res.status(201).json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to process wearable sync" });
  }
});

export default router;
