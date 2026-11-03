import { storage } from "./storage";
import { getKV, setKV } from "./db";
import { HealthContextModel } from "./coachMemory";

// ============================================================================
// LUMEN GOOGLE GEMINI AI BIO-INTELLIGENCE ADVISOR
// Multi-turn conversational bio-data analysis powered by Google Gemini API
// ============================================================================

function getInitialGeminiKey(): string {
  if (process.env.EXPO_PUBLIC_GEMINI_API_KEY) {
    return process.env.EXPO_PUBLIC_GEMINI_API_KEY.trim();
  }
  return "";
}

export const DEFAULT_GEMINI_API_KEY = getInitialGeminiKey();
const STORAGE_KEY_GEMINI = "lumen_gemini_api_key_v1";

/**
 * Validates if the string has a valid Google Gemini API key format:
 * - New Google AI Studio Authorization Key: starts with "AQ." (e.g. AQ.Ab8...)
 * - Legacy Google Cloud Standard API Key: starts with "AIza" (e.g. AIzaSy...)
 */
export function isValidGeminiApiKey(key?: string | null): boolean {
  if (!key) return false;
  const clean = key.trim();
  return (clean.startsWith("AQ.") || clean.startsWith("AIza")) && clean.length >= 25;
}

/**
 * Returns the currently active Gemini API key (from user storage or default).
 */
export async function getGeminiApiKey(): Promise<string> {
  try {
    const customKey = await storage.getItem(STORAGE_KEY_GEMINI);
    if (customKey && customKey.trim()) {
      return customKey.trim();
    }
    const kvKey = await getKV(STORAGE_KEY_GEMINI);
    if (kvKey && kvKey.trim()) {
      return kvKey.trim();
    }
  } catch (err) {
    console.warn("Failed retrieving stored Gemini API key:", err);
  }
  return DEFAULT_GEMINI_API_KEY;
}

/**
 * Persists an updated Gemini API key to local storage and SQLite.
 */
export async function setGeminiApiKey(apiKey: string): Promise<void> {
  const clean = apiKey.trim();
  await storage.setItem(STORAGE_KEY_GEMINI, clean);
  await setKV(STORAGE_KEY_GEMINI, clean);
}

/**
 * Constructs the clinical bio-intelligence system prompt for Gemini,
 * injecting live telemetry (nutrition, sleep, activity, screen time, hydration).
 */
export function buildGeminiSystemPrompt(context: HealthContextModel): string {
  const persona = "Elite Performance & Longevity Coach";

  return `You are Lumen Bio-Intelligence Coach, an elite, evidence-based AI longevity, fitness, and recovery advisor.
You are powered by Google Gemini and have direct access to the user's real-time continuous physiological telemetry.

YOUR CURRENT USER & BIOMETRIC TELEMETRY:
========================================
- Name: ${context.profile.name}
- Clinical Protocol / Mode: ${context.profile.mode}
- Persona Style: ${persona}

LIVE BIOMARKERS TODAY:
----------------------
1. NUTRITION:
   - Calories Consumed: ${context.nutrition.totalCalories} kcal / Target: ${context.nutrition.calorieTarget} kcal (${context.nutrition.calorieRemaining} kcal remaining)
   - Protein: ${context.nutrition.totalProtein}g / Target: ${context.nutrition.proteinTarget}g
   - Carbohydrates: ${context.nutrition.totalCarbs}g | Fat: ${context.nutrition.totalFat}g
   - Meals Logged: ${context.nutrition.mealsCount}
   ${context.nutrition.mealsList.length > 0 ? "Meals: " + context.nutrition.mealsList.map((m) => `${m.name} (${m.calories}kcal, ${m.protein}g protein)`).join(", ") : "No meals logged yet today."}

2. PHYSICAL ACTIVITY & MOVEMENT:
   - Steps Today: ${context.activity.steps.toLocaleString()} / Target: ${context.activity.stepsTarget.toLocaleString()} (${context.activity.stepsPercent}%)
   - Active Energy Burned: ${context.activity.activeCaloriesBurned} kcal
   - Workouts Completed: ${context.activity.workoutsCount}
   ${context.activity.workoutsList.length > 0 ? "Workouts: " + context.activity.workoutsList.map((w) => `${w.type} (${w.duration}m, ${w.calories}kcal)`).join(", ") : "No structured workouts logged yet today."}

3. SLEEP & CIRCADIAN RECOVERY:
   - Duration: ${context.sleep.durationHours} hours (Target: ${context.sleep.targetHours}h)
   - Deep Sleep: ${context.sleep.deepSleepStr} | REM Sleep: ${context.sleep.remSleepStr}
   - Quality Rating: ${context.sleep.quality} (Status: ${context.sleep.status})

4. DIGITAL WELLBEING & SCREEN TIME:
   - Screen Time Today: ${context.screenTime.hoursStr} (Mindful Budget: ${context.screenTime.limitHoursStr})
   - Status: ${context.screenTime.status} | Focus Mode Active: ${context.screenTime.focusMode ? "YES" : "NO"}

5. HYDRATION:
   - Water Intake: ${context.hydration.cups} cups (${context.hydration.ml} ml) / Target: ${context.hydration.targetCups} cups

USER LONG-TERM HEALTH MEMORIES & PREFERENCES:
--------------------------------------------
${context.memories && context.memories.length > 0 ? context.memories.map((m) => `• [${m.category.toUpperCase()}]: ${m.keyFact}`).join("\n") : "None recorded yet."}

INSTRUCTIONS FOR YOUR RESPONSE:
===============================
1. Always ground your analysis directly in the user's specific numbers and biological targets.
2. Provide actionable, science-based recommendations (Huberman / Attia / WHOOP / Oura standard).
3. If the user asks about meals, macros, workouts, recovery, sleep, or screen time, provide clear, encouraging, direct insights.
4. Format your response cleanly in GitHub Markdown using bold headings, bullet points, and crisp action steps.
5. Be concise yet deeply knowledgeable. Avoid generic filler.`;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GeminiEndpointConfig {
  version: "v1" | "v1beta";
  model: string;
}

export const GEMINI_CANDIDATE_ENDPOINTS: GeminiEndpointConfig[] = [
  { version: "v1", model: "gemini-1.5-flash" },
  { version: "v1beta", model: "gemini-2.0-flash" },
  { version: "v1beta", model: "gemini-2.5-flash" },
  { version: "v1", model: "gemini-2.0-flash" },
  { version: "v1beta", model: "gemini-1.5-flash-latest" },
  { version: "v1", model: "gemini-1.5-pro" },
  { version: "v1beta", model: "gemini-1.5-pro" },
];

let cachedWorkingEndpoint: GeminiEndpointConfig | null = null;

function getEndpointsToAttempt(): GeminiEndpointConfig[] {
  if (cachedWorkingEndpoint) {
    return [
      cachedWorkingEndpoint,
      ...GEMINI_CANDIDATE_ENDPOINTS.filter(
        (e) => e.version !== cachedWorkingEndpoint!.version || e.model !== cachedWorkingEndpoint!.model
      ),
    ];
  }
  return GEMINI_CANDIDATE_ENDPOINTS;
}

/**
 * Sends a conversation to the Google Gemini API and returns the AI response text.
 */
export async function askGeminiCoach(
  userPrompt: string,
  history: ChatMessage[],
  context: HealthContextModel
): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey || !isValidGeminiApiKey(apiKey)) {
    throw new Error("No valid Google Gemini API key configured. Please add your key in Coach settings.");
  }
  const systemPrompt = buildGeminiSystemPrompt(context);

  // Convert conversation history to Gemini contents format
  const recentHistory = history.slice(-8); // Keep last 8 turns for context window efficiency
  const contents = [
    ...recentHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    })),
    {
      role: "user",
      parts: [
        {
          text: `[SYSTEM CONTEXT & LIVE BIOMARKERS]:\n${systemPrompt}\n\n[USER QUERY]:\n${userPrompt}`,
        },
      ],
    },
  ];

  let lastError: any = null;
  const endpoints = getEndpointsToAttempt();

  for (const ep of endpoints) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ep.version}/models/${ep.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            topP: 0.9,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const candidate = data?.candidates?.[0];
        const textPart = candidate?.content?.parts?.[0]?.text;
        if (textPart && typeof textPart === "string" && textPart.trim()) {
          cachedWorkingEndpoint = ep;
          return textPart.trim();
        }
      } else {
        const errorText = await response.text();
        console.warn(`Gemini ${ep.version}/${ep.model} returned status ${response.status}:`, errorText);
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);

        // If 404 (model not found on that version), silently continue to next candidate
        if (response.status === 404) {
          continue;
        }

        // If 401 / 403, also attempt Bearer token format in case key is a Google Cloud / Vertex token
        if (response.status === 401 || response.status === 403) {
          try {
            const bearerUrl = `https://generativelanguage.googleapis.com/${ep.version}/models/${ep.model}:generateContent`;
            const bearerRes = await fetch(bearerUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                },
              }),
            });
            if (bearerRes.ok) {
              const bData = await bearerRes.json();
              const bText = bData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (bText && typeof bText === "string") {
                cachedWorkingEndpoint = ep;
                return bText.trim();
              }
            }
          } catch (bErr) {
            console.warn("Bearer auth attempt failed:", bErr);
          }
        }
      }
    } catch (err) {
      console.warn(`Gemini fetch error on ${ep.version}/${ep.model}:`, err);
      lastError = err;
    }
  }

  // If all candidates failed
  throw lastError || new Error("Failed to communicate with Google Gemini API.");
}

/**
 * Validates the Gemini API key by sending a minimal test probe.
 * Checks ModelService.ListModels and probes candidate versions (v1 & v1beta).
 */
export async function testGeminiApiKey(keyToTest?: string): Promise<{ success: boolean; message: string }> {
  const key = (keyToTest || (await getGeminiApiKey())).trim();
  if (!key) {
    return { success: false, message: "API key is empty. Enter an API key from Google AI Studio." };
  }

  // 1. Try querying ListModels to verify key and discover supported models
  try {
    for (const v of ["v1beta", "v1"] as const) {
      const listUrl = `https://generativelanguage.googleapis.com/${v}/models?key=${encodeURIComponent(key)}`;
      const listRes = await fetch(listUrl, {
        headers: { "x-goog-api-key": key },
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const models: any[] = listData.models || [];
        // Find a model that supports generateContent
        const validModel = models.find(
          (m: any) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes("generateContent") &&
            (m.name?.includes("flash") || m.name?.includes("gemini"))
        );
        if (validModel) {
          const rawName = validModel.name?.replace(/^models\//, "") || "gemini-1.5-flash";
          cachedWorkingEndpoint = { version: v, model: rawName };
          return {
            success: true,
            message: `Connected to Google Gemini! Verified model: ${rawName} (${v})`,
          };
        }
      }
    }
  } catch (probeErr) {
    console.warn("ListModels discovery probe skipped:", probeErr);
  }

  // 2. Direct generateContent probes across candidate versions & models
  let lastErrorSummary = "";
  for (const ep of GEMINI_CANDIDATE_ENDPOINTS) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ep.version}/models/${ep.model}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Ping. Reply with: OK" }] }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        cachedWorkingEndpoint = ep;
        return {
          success: true,
          message: `Connected to Google Gemini (${ep.model} on ${ep.version})! Response: "${text?.trim() || "OK"}"`,
        };
      } else {
        const err = await response.text();
        lastErrorSummary = `HTTP ${response.status}: ${err}`;
        // If 404, silently test the next candidate endpoint
        if (response.status === 404) {
          continue;
        }
        // If 400 or 403, key was actively rejected
        return { success: false, message: `API rejected with ${lastErrorSummary}` };
      }
    } catch (err: any) {
      lastErrorSummary = `Network error: ${err.message}`;
    }
  }

  return { success: false, message: `API connection failed: ${lastErrorSummary}` };
}

export interface FoodRecognitionResult {
  name: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  vitamins: string;
  items: Array<{
    name: string;
    quantity: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    confidence?: number;
  }>;
  notes: string;
  confidence: number;
}

/**
 * Analyzes food photos directly with Google Gemini 1.5 Flash Vision.
 */
export async function analyzeFoodImageWithGemini(
  base64OrDataUri: string,
  hint: string = ""
): Promise<FoodRecognitionResult> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey || !isValidGeminiApiKey(apiKey)) {
    throw new Error("Valid Gemini API key required (starts with AQ. or AIza).");
  }

  // Extract clean base64 data and mime type
  let mimeType = "image/jpeg";
  let cleanBase64 = base64OrDataUri;

  if (base64OrDataUri.startsWith("data:")) {
    const parts = base64OrDataUri.split(",");
    const meta = parts[0];
    cleanBase64 = parts[1] || "";
    if (meta.includes("image/png")) mimeType = "image/png";
    else if (meta.includes("image/webp")) mimeType = "image/webp";
    else if (meta.includes("image/jpeg") || meta.includes("image/jpg")) mimeType = "image/jpeg";
  }

  const promptText = `You are an elite clinical nutritionist and computer vision AI.
Analyze this food photograph and estimate its precise nutritional breakdown.
${hint ? `User context/hint: "${hint}"` : ""}

Return ONLY a valid JSON object matching this exact schema:
{
  "name": "Short descriptive name of the dish",
  "mealType": "breakfast" | "lunch" | "dinner" | "snack",
  "calories": 450,
  "proteinGrams": 32,
  "carbsGrams": 40,
  "fatGrams": 14,
  "vitamins": "Key micronutrients identified (e.g. Vitamin C, Iron, Calcium, B12)",
  "items": [
    {
      "name": "Food item or ingredient",
      "quantity": "Portion size (e.g. 150g or 1 cup)",
      "calories": 250,
      "proteinGrams": 28,
      "carbsGrams": 0,
      "fatGrams": 5
    }
  ],
  "notes": "Actionable clinical dietary advice regarding this meal's macronutrient balance and digestion.",
  "confidence": 0.95
}`;

  const endpoints = getEndpointsToAttempt();
  let lastVisionError: any = null;

  for (const ep of endpoints) {
    try {
      const url = `https://generativelanguage.googleapis.com/${ep.version}/models/${ep.model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64.trim(),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini Vision on ${ep.version}/${ep.model} returned HTTP ${response.status}:`, errorText);
        lastVisionError = new Error(`HTTP ${response.status}: ${errorText}`);
        // If 404, try next candidate model
        if (response.status === 404) {
          continue;
        }
        throw lastVisionError;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        continue;
      }

      cachedWorkingEndpoint = ep;

      // Parse JSON, handling potential markdown fences
      let cleanJson = rawText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(cleanJson);
      return {
        name: parsed.name || "Identified Meal",
        mealType: ["breakfast", "lunch", "dinner", "snack"].includes(parsed.mealType) ? parsed.mealType : "lunch",
        calories: Number(parsed.calories) || 0,
        proteinGrams: Number(parsed.proteinGrams) || 0,
        carbsGrams: Number(parsed.carbsGrams) || 0,
        fatGrams: Number(parsed.fatGrams) || 0,
        vitamins: parsed.vitamins || "Micronutrients identified",
        items: Array.isArray(parsed.items) ? parsed.items : [],
        notes: parsed.notes || "Identified via Lumen Gemini Vision.",
        confidence: Number(parsed.confidence) || 0.92,
      };
    } catch (err: any) {
      lastVisionError = err;
    }
  }

  throw lastVisionError || new Error("Failed to analyze food image with Gemini Vision across all candidate models.");
}
