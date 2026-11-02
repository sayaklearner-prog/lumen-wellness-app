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
 * Validates if the string has the official Google Gemini API key format (starts with AIzaSy...).
 */
export function isValidGeminiApiKey(key?: string | null): boolean {
  if (!key) return false;
  const clean = key.trim();
  return clean.startsWith("AIzaSy") && clean.length >= 35;
}

/**
 * Returns the currently active Gemini API key (from user storage or default).
 * Automatically purges deprecated/invalid tokens (e.g. Firebase tokens starting with AQ.Ab8).
 */
export async function getGeminiApiKey(): Promise<string> {
  try {
    const customKey = await storage.getItem(STORAGE_KEY_GEMINI);
    if (customKey && customKey.trim()) {
      const clean = customKey.trim();
      // If a stale Firebase token was previously saved, purge it
      if (clean.startsWith("AQ.Ab8")) {
        await storage.removeItem(STORAGE_KEY_GEMINI);
        await setKV(STORAGE_KEY_GEMINI, "");
      } else {
        return clean;
      }
    }
    const kvKey = await getKV(STORAGE_KEY_GEMINI);
    if (kvKey && kvKey.trim()) {
      const clean = kvKey.trim();
      if (clean.startsWith("AQ.Ab8")) {
        await setKV(STORAGE_KEY_GEMINI, "");
      } else {
        return clean;
      }
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
    throw new Error("No valid Google Gemini API key configured. Please add your key starting with AIzaSy... in Coach settings.");
  }
  const systemPrompt = buildGeminiSystemPrompt(context);

  // Models to attempt in priority order
  const modelEndpoints = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ];

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

  for (const model of modelEndpoints) {
    // 1. Try with URL query param + standard x-goog-api-key header
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
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
          return textPart.trim();
        }
      } else {
        const errorText = await response.text();
        console.warn(`Gemini ${model} request returned status ${response.status}:`, errorText);
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);

        // If 401 / 403, also attempt Bearer token format in case key is a Google Cloud / Vertex token
        if (response.status === 401 || response.status === 403) {
          try {
            const bearerUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
                return bText.trim();
              }
            }
          } catch (bErr) {
            console.warn("Bearer auth attempt failed:", bErr);
          }
        }
      }
    } catch (err) {
      console.warn(`Gemini fetch error on model ${model}:`, err);
      lastError = err;
    }
  }

  // If online Gemini fails (e.g. no internet connectivity or invalid key error),
  // rethrow with clear error message so caller can display or fallback
  throw lastError || new Error("Failed to communicate with Google Gemini API.");
}

/**
 * Validates the Gemini API key by sending a minimal test probe.
 */
export async function testGeminiApiKey(keyToTest?: string): Promise<{ success: boolean; message: string }> {
  const key = (keyToTest || (await getGeminiApiKey())).trim();
  if (!key) {
    return { success: false, message: "API key is empty. Enter an API key starting with AIzaSy..." };
  }

  if (key.startsWith("AQ.Ab8")) {
    return {
      success: false,
      message: "This key is a Firebase/OAuth token, not a Google Gemini API key. Please generate a Gemini key (starts with AIzaSy...) at https://aistudio.google.com/app/apikey",
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
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
      return { success: true, message: `Connected to Google Gemini! Response: "${text?.trim()}"` };
    } else {
      const err = await response.text();
      return { success: false, message: `API rejected with HTTP ${response.status}: ${err}` };
    }
  } catch (err: any) {
    return { success: false, message: `Network error: ${err.message}` };
  }
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
    throw new Error("Valid Gemini API key required (must start with AIzaSy).");
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

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
    throw new Error(`Gemini Vision rejected HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("No response content from Gemini Vision.");
  }

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
}
