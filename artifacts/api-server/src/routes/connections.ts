import { Router, type IRouter } from "express";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";
import {
  db,
  healthConnectionsTable,
  workoutsTable,
  sleepTable,
  type HealthConnectionRow,
} from "@workspace/db";
import { ImportAppleHealthDataBody } from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_PROVIDERS = [
  "apple_health",
  "google_fit",
  "fitbit",
  "garmin",
  "oura",
  "whoop",
  "manual",
] as const;

function serializeConnection(c: HealthConnectionRow) {
  return {
    id: c.id,
    provider: c.provider,
    status: c.status,
    lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
    syncedRecordCount: c.syncedRecordCount,
    createdAt: c.createdAt.toISOString(),
  };
}

async function getOrCreateConnection(provider: string): Promise<HealthConnectionRow> {
  const existing = await db
    .select()
    .from(healthConnectionsTable)
    .where(eq(healthConnectionsTable.provider, provider));
  if (existing.length > 0) return existing[0]!;
  const [created] = await db
    .insert(healthConnectionsTable)
    .values({ provider, status: "disconnected" })
    .returning();
  return created!;
}

router.get("/connections", async (_req, res): Promise<void> => {
  // Ensure all providers have a row.
  for (const p of VALID_PROVIDERS) {
    await getOrCreateConnection(p);
  }
  const all = await db.select().from(healthConnectionsTable);
  res.json(all.map(serializeConnection));
});

router.post(
  "/connections/:provider/connect",
  async (req, res): Promise<void> => {
    const provider = req.params["provider"]!;
    if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
      res.status(400).json({ error: "Unknown provider" });
      return;
    }
    await getOrCreateConnection(provider);
    const [updated] = await db
      .update(healthConnectionsTable)
      .set({ status: "connected" })
      .where(eq(healthConnectionsTable.provider, provider))
      .returning();
    res.json(serializeConnection(updated!));
  },
);

router.post(
  "/connections/:provider/disconnect",
  async (req, res): Promise<void> => {
    const provider = req.params["provider"]!;
    if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
      res.status(400).json({ error: "Unknown provider" });
      return;
    }
    await getOrCreateConnection(provider);
    const [updated] = await db
      .update(healthConnectionsTable)
      .set({ status: "disconnected" })
      .where(eq(healthConnectionsTable.provider, provider))
      .returning();
    res.json(serializeConnection(updated!));
  },
);

router.post("/connections/:provider/sync", async (req, res): Promise<void> => {
  const provider = req.params["provider"]!;
  if (!VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
    res.status(400).json({ error: "Unknown provider" });
    return;
  }
  const conn = await getOrCreateConnection(provider);
  if (conn.status !== "connected") {
    res.status(400).json({ error: "Provider is not connected" });
    return;
  }

  // Mock a representative sync for non-Apple providers (Google Fit / Fitbit / etc).
  // In a real deployment this would hit the provider's REST API.
  const seedSteps = 7800 + Math.floor(Math.random() * 3500);
  const seedActiveMin = 22 + Math.floor(Math.random() * 30);
  const [workout] = await db
    .insert(workoutsTable)
    .values({
      type: "Synced from " + provider.replace("_", " "),
      durationMinutes: seedActiveMin,
      caloriesBurned: Math.round(seedActiveMin * 6.5),
      steps: seedSteps,
      intensity: seedActiveMin >= 30 ? "moderate" : "light",
      source: "sensor",
    })
    .returning();

  const importedSleepEntries = 0;
  const importedHr = 96 + Math.floor(Math.random() * 64);

  const [updated] = await db
    .update(healthConnectionsTable)
    .set({
      lastSyncedAt: new Date(),
      syncedRecordCount: conn.syncedRecordCount + 1,
    })
    .where(eq(healthConnectionsTable.provider, provider))
    .returning();

  res.json({
    provider,
    importedSteps: workout?.steps ?? 0,
    importedSleepEntries,
    importedWorkouts: 1,
    importedHeartRateSamples: importedHr,
    message: `Pulled ${workout?.steps ?? 0} steps and ${importedHr} heart-rate samples from ${provider.replace("_", " ")}.`,
    connection: serializeConnection(updated!),
  });
});

router.post(
  "/connections/apple-health/import",
  async (req, res): Promise<void> => {
    const parsed = ImportAppleHealthDataBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    let xml: string | null = null;
    try {
      const buf = Buffer.from(parsed.data.zipBase64, "base64");
      // Apple Health export ships as a zip containing apple_health_export/export.xml.
      // If user uploaded the XML directly it may already be plaintext.
      try {
        const zip = new AdmZip(buf);
        const entries = zip.getEntries();
        const exportEntry = entries.find(
          (e) =>
            e.entryName.endsWith("export.xml") ||
            e.entryName.endsWith("Export.xml"),
        );
        if (exportEntry) {
          xml = exportEntry.getData().toString("utf-8");
        }
      } catch {
        // Not a zip — fall through to treat as raw XML.
      }
      if (!xml) {
        xml = buf.toString("utf-8");
      }
    } catch (err) {
      req.log.error({ err }, "Apple Health decode failed");
      res.status(400).json({ error: "Could not decode payload" });
      return;
    }

    if (!xml.includes("<HealthData") && !xml.includes("HKQuantity")) {
      res.status(400).json({
        error:
          "File doesn't look like an Apple Health export. Export Health Data from the Apple Health app and upload the resulting export.zip.",
      });
      return;
    }

    let importedSteps = 0;
    let importedSleepEntries = 0;
    let importedWorkouts = 0;
    let importedHeartRateSamples = 0;

    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        allowBooleanAttributes: true,
        // Health exports can be huge; keep parsing strict.
      });
      const json = parser.parse(xml) as {
        HealthData?: {
          Record?: Array<Record<string, unknown>> | Record<string, unknown>;
          Workout?: Array<Record<string, unknown>> | Record<string, unknown>;
        };
      };
      const records = json.HealthData?.Record;
      const workouts = json.HealthData?.Workout;

      const recordList = Array.isArray(records) ? records : records ? [records] : [];
      const workoutList = Array.isArray(workouts) ? workouts : workouts ? [workouts] : [];

      // Aggregate steps per day to avoid creating millions of rows.
      const stepsByDay: Record<string, number> = {};
      for (const r of recordList) {
        const type = r["@_type"] as string | undefined;
        const value = Number(r["@_value"]);
        const startDate = r["@_startDate"] as string | undefined;
        if (!type || !startDate || !Number.isFinite(value)) continue;
        const day = startDate.slice(0, 10);

        if (type === "HKQuantityTypeIdentifierStepCount") {
          stepsByDay[day] = (stepsByDay[day] ?? 0) + value;
          importedSteps += value;
        } else if (type === "HKCategoryTypeIdentifierSleepAnalysis") {
          const endDate = r["@_endDate"] as string | undefined;
          if (endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const hours = (end.getTime() - start.getTime()) / 1000 / 3600;
            if (hours >= 3 && hours <= 14) {
              await db.insert(sleepTable).values({
                date: day,
                durationHours: hours.toFixed(2),
                quality: hours >= 7 ? "good" : "fair",
                bedtime: start.toISOString().slice(11, 16),
                wakeTime: end.toISOString().slice(11, 16),
                deepSleepHours: (hours * 0.18).toFixed(2),
                notes: "Imported from Apple Health",
              });
              importedSleepEntries++;
            }
          }
        } else if (type === "HKQuantityTypeIdentifierHeartRate") {
          importedHeartRateSamples++;
        }
      }

      // Create one synthetic "Steps" workout per day with totaled steps (caps the noise).
      for (const [day, totalSteps] of Object.entries(stepsByDay)) {
        const rounded = Math.round(totalSteps);
        await db.insert(workoutsTable).values({
          type: "Apple Health steps",
          durationMinutes: Math.min(180, Math.max(5, Math.round(rounded / 100))),
          caloriesBurned: Math.round(rounded * 0.04),
          steps: rounded,
          intensity: rounded >= 9000 ? "moderate" : "light",
          source: "sensor",
          loggedAt: new Date(`${day}T18:00:00Z`),
        });
        importedWorkouts++;
      }

      for (const w of workoutList) {
        const startDate = w["@_startDate"] as string | undefined;
        const dur = Number(w["@_duration"]);
        const cal = Number(w["@_totalEnergyBurned"]);
        if (!startDate || !Number.isFinite(dur)) continue;
        await db.insert(workoutsTable).values({
          type: String(w["@_workoutActivityType"] ?? "Workout").replace(
            "HKWorkoutActivityType",
            "",
          ),
          durationMinutes: Math.round(dur),
          caloriesBurned: Number.isFinite(cal) ? Math.round(cal) : Math.round(dur * 6),
          steps: 0,
          intensity: dur >= 30 ? "moderate" : "light",
          source: "sensor",
          loggedAt: new Date(startDate),
        });
        importedWorkouts++;
      }
    } catch (err) {
      req.log.error({ err }, "Apple Health XML parse failed");
      res.status(400).json({ error: "Could not parse Apple Health XML" });
      return;
    }

    const conn = await getOrCreateConnection("apple_health");
    const [updated] = await db
      .update(healthConnectionsTable)
      .set({
        status: "connected",
        lastSyncedAt: new Date(),
        syncedRecordCount: conn.syncedRecordCount + importedWorkouts,
        metadata: {
          filename: parsed.data.filename ?? "export.zip",
          importedSteps,
        },
      })
      .where(eq(healthConnectionsTable.provider, "apple_health"))
      .returning();

    res.json({
      provider: "apple_health",
      importedSteps: Math.round(importedSteps),
      importedSleepEntries,
      importedWorkouts,
      importedHeartRateSamples,
      message: `Imported ${Math.round(importedSteps).toLocaleString()} steps, ${importedSleepEntries} sleep entries, ${importedWorkouts} workouts, and ${importedHeartRateSamples.toLocaleString()} heart-rate samples from Apple Health.`,
      connection: serializeConnection(updated!),
    });
  },
);

export default router;
