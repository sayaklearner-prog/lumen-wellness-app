import { Router, type IRouter } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { AnalyzeFoodPhotoBody } from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/store";

const router: IRouter = Router();

router.post("/vision/food", async (req, res): Promise<void> => {
  const parsed = AnalyzeFoodPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64, hint } = parsed.data;
  type AllowedMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const ALLOWED: readonly AllowedMedia[] = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  let mediaType: AllowedMedia = "image/jpeg";
  let raw = imageBase64;
  const m = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (m) {
    const detected = m[1]!.toLowerCase();
    mediaType = (ALLOWED as readonly string[]).includes(detected)
      ? (detected as AllowedMedia)
      : "image/jpeg";
    raw = m[2]!;
  }

  const profile = await getOrCreateProfile();
  const modeContext =
    profile.mode === "diabetes"
      ? " The user has diabetes — flag carb-heavy items in modelNotes."
      : profile.mode === "weight_loss"
        ? " The user is in a weight-loss phase — note any high-calorie surprises in modelNotes."
        : "";

  const prompt = `Analyze the food in this image and return a JSON object describing the meal. Estimate portions visually and return realistic nutrition facts. Return ONLY a JSON object (no prose, no markdown, no code fences) matching exactly this shape:

{
  "mealName": "short name like 'Grilled chicken salad'",
  "suggestedMealType": "breakfast|lunch|dinner|snack",
  "items": [
    {
      "name": "string",
      "portion": "human readable portion e.g. '1 cup' or '120g'",
      "calories": integer,
      "proteinGrams": integer,
      "carbsGrams": integer,
      "fatGrams": integer,
      "confidence": number 0-1
    }
  ],
  "totalCalories": integer (sum of items.calories),
  "totalProteinGrams": integer (sum),
  "totalCarbsGrams": integer (sum),
  "totalFatGrams": integer (sum),
  "modelNotes": "1-2 short sentences with health-relevant observations.",
  "confidence": number 0-1 (overall)
}

Hint from user: ${hint || "(none)"}.${modeContext}

If the image clearly does not contain food, return a single item with name "Not food", portion "n/a", all nutrition zero, and confidence 0.05.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: raw },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      res.status(502).json({ error: "Empty model response" });
      return;
    }
    let text = block.text.trim();
    // Strip code fences if the model wrapped them despite instructions.
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      // Try to extract first {...} block.
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(502).json({ error: "Could not parse model JSON" });
        return;
      }
      parsedJson = JSON.parse(match[0]);
    }

    const result = parsedJson as {
      mealName?: string;
      suggestedMealType?: string;
      items?: Array<{
        name?: string;
        portion?: string;
        calories?: number;
        proteinGrams?: number;
        carbsGrams?: number;
        fatGrams?: number;
        confidence?: number;
      }>;
      totalCalories?: number;
      totalProteinGrams?: number;
      totalCarbsGrams?: number;
      totalFatGrams?: number;
      modelNotes?: string;
      confidence?: number;
    };

    const items = (result.items ?? []).map((it) => ({
      name: String(it.name ?? "Item"),
      portion: String(it.portion ?? "1 serving"),
      calories: Math.max(0, Math.round(Number(it.calories) || 0)),
      proteinGrams: Math.max(0, Math.round(Number(it.proteinGrams) || 0)),
      carbsGrams: Math.max(0, Math.round(Number(it.carbsGrams) || 0)),
      fatGrams: Math.max(0, Math.round(Number(it.fatGrams) || 0)),
      confidence: Math.min(
        1,
        Math.max(0, Number(it.confidence) || 0.5),
      ),
    }));

    const sum = (k: "calories" | "proteinGrams" | "carbsGrams" | "fatGrams") =>
      items.reduce((a, b) => a + b[k], 0);

    const totalCalories = result.totalCalories ?? sum("calories");
    const totalProtein = result.totalProteinGrams ?? sum("proteinGrams");
    const totalCarbs = result.totalCarbsGrams ?? sum("carbsGrams");
    const totalFat = result.totalFatGrams ?? sum("fatGrams");

    const allowedTypes = ["breakfast", "lunch", "dinner", "snack"];
    let suggestedType = String(result.suggestedMealType ?? "snack").toLowerCase();
    if (!allowedTypes.includes(suggestedType)) suggestedType = "snack";

    res.json({
      mealName: String(result.mealName ?? "Detected meal"),
      suggestedMealType: suggestedType,
      items,
      totalCalories: Math.max(0, Math.round(totalCalories)),
      totalProteinGrams: Math.max(0, Math.round(totalProtein)),
      totalCarbsGrams: Math.max(0, Math.round(totalCarbs)),
      totalFatGrams: Math.max(0, Math.round(totalFat)),
      modelNotes: result.modelNotes ?? "",
      confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0.5)),
    });
  } catch (err) {
    req.log.error({ err }, "Vision food analysis failed");
    res.status(500).json({ error: "Vision analysis failed" });
  }
});

export default router;
