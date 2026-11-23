/**
 * CLINICAL HEALTH PROFILE & TARGET AUTO-ADJUSTMENT ENGINE
 * 
 * Evidence-based clinical protocol configuration for Lumen AI OS:
 * - Multi-condition profiles (Pregnancy, Diabetes, Hypertension, Heart Health, Weight Loss)
 * - Condition-adaptive target calculation (Steps, Calories, Carbs, Protein, Hydration)
 * - Clinical guardrails and evidence-informed nutritional/movement pacing
 */

import { storage } from "./storage";

export type ClinicalConditionId =
  | "standard"
  | "diabetes"
  | "pregnancy"
  | "hypertension"
  | "heart_health"
  | "weight_loss";

export type DiabetesType = "type1" | "type2" | "gestational" | "prediabetes";
export type PregnancyStage = "trimester_1" | "trimester_2" | "trimester_3" | "postpartum";

export interface DiabetesDetails {
  type: DiabetesType;
  onInsulinOrMeds: boolean;
  targetFastingMgDl?: number;
  targetPostMealMgDl?: number;
}

export interface PregnancyDetails {
  stage: PregnancyStage;
  gestationalWeek?: number;
  dueDate?: string;
}

export interface HypertensionDetails {
  sodiumLimitMg: number;
}

export interface ClinicalProfile {
  conditions: ClinicalConditionId[];
  diabetes?: DiabetesDetails;
  pregnancy?: PregnancyDetails;
  hypertension?: HypertensionDetails;
  updatedAt?: string;
}

export interface ClinicalTargets {
  stepsTarget: number;
  calorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  waterTargetMl: number;
  sodiumLimitMg?: number;
  clinicalBadges: string[];
  clinicalNotes: string[];
}

export const DEFAULT_CLINICAL_PROFILE: ClinicalProfile = {
  conditions: ["standard"],
  diabetes: {
    type: "type2",
    onInsulinOrMeds: false,
    targetFastingMgDl: 100,
    targetPostMealMgDl: 140,
  },
  pregnancy: {
    stage: "trimester_1",
    gestationalWeek: 8,
  },
  hypertension: {
    sodiumLimitMg: 1800,
  },
  updatedAt: new Date().toISOString(),
};

/**
 * Calculates evidence-informed movement, caloric, and macronutrient targets
 * tailored dynamically to the user's specific clinical conditions.
 */
export function calculateClinicalTargets(
  profile: ClinicalProfile,
  biometrics?: {
    weightKg?: number;
    heightCm?: number;
    gender?: string;
    age?: number;
  }
): ClinicalTargets {
  const weightKg = biometrics?.weightKg || 72;
  const heightCm = biometrics?.heightCm || 175;
  const gender = biometrics?.gender || "Male";
  const age = biometrics?.age || 30;

  // 1. Basal Metabolic Rate (Mifflin-St Jeor Equation)
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender.toLowerCase() === "female") {
    bmr -= 161;
  } else {
    bmr += 5;
  }

  // 2. Base Total Daily Energy Expenditure (TDEE ~1.375 moderate multiplier)
  let baseTdee = Math.round((bmr * 1.35) / 50) * 50;
  baseTdee = Math.max(1500, Math.min(3200, baseTdee));

  let steps = 10000;
  let calories = baseTdee;
  let protein = Math.round(weightKg * 1.4); // 1.4g/kg baseline
  let waterMl = 2500;
  let sodiumMg: number | undefined = undefined;

  const badges: string[] = [];
  const notes: string[] = [];

  const conditions = profile.conditions || ["standard"];
  const isPregnant = conditions.includes("pregnancy");
  const isDiabetic = conditions.includes("diabetes");
  const isHypertensive = conditions.includes("hypertension");
  const isWeightLoss = conditions.includes("weight_loss");

  // 3. Evaluate Pregnancy Protocol
  if (isPregnant) {
    const stage = profile.pregnancy?.stage || "trimester_1";
    if (stage === "trimester_1") {
      // 1st trimester: 0 extra kcal, focus on Folate, B6, gentle mobility
      steps = 7000;
      protein = Math.max(protein, Math.round(weightKg * 1.3) + 10);
      waterMl = 2700;
      badges.push("Prenatal: 1st Trimester");
      notes.push("Gentle non-exhausting walks. Focus on Folate (600mcg), Vitamin B6 for nausea, and restorative hydration.");
    } else if (stage === "trimester_2") {
      // 2nd trimester: +340 kcal/day, +25g protein
      calories += 340;
      steps = 6000;
      protein += 25;
      waterMl = 3000;
      badges.push("Prenatal: 2nd Trimester (+340 kcal)");
      notes.push("Fetal growth phase: elevated protein (+25g) and energy (+340 kcal). Pelvic stability walks, rest breaks.");
    } else if (stage === "trimester_3") {
      // 3rd trimester: +450 kcal/day, +25g protein, gentler steps
      calories += 450;
      steps = 5000;
      protein += 25;
      waterMl = 3200;
      badges.push("Prenatal: 3rd Trimester (+450 kcal)");
      notes.push("Maternal sustenance: smaller frequent meals, amniotic volume support (3.2L), low-impact restorative mobility.");
    } else {
      // Postpartum / Lactation: +500 kcal/day, +25g protein
      calories += 500;
      steps = 7500;
      protein += 25;
      waterMl = 3500;
      badges.push("Postpartum / Lactation (+500 kcal)");
      notes.push("Lactation recovery: enhanced hydration (3.5L), electrolyte support, restorative pelvic floor walking.");
    }
  }

  // 4. Evaluate Diabetes Protocol
  if (isDiabetic) {
    const dType = profile.diabetes?.type || "type2";
    if (isPregnant) {
      // Combined: Gestational Diabetes Protocol
      steps = 6000;
      badges.push("Gestational Diabetes Protocol");
      notes.push("Glycemic pacing: 15-minute gentle walk 30 mins after main meals. Controlled carbohydrate pacing to protect fetal development.");
    } else {
      // Standard Diabetes Protocol
      steps = 8000;
      badges.push(`Glycemic Protocol (${dType.toUpperCase()})`);
      notes.push("Postprandial glycemic pacing: 10–15 min walks after meals to stimulate GLUT4 glucose uptake. High soluble fiber (35g+).");
    }
  }

  // 5. Evaluate Hypertension Protocol
  if (isHypertensive) {
    sodiumMg = profile.hypertension?.sodiumLimitMg || 1800;
    badges.push(`DASH Protocol (Sodium <${sodiumMg}mg)`);
    notes.push("Cardiovascular vascular tone: Zone 2 aerobic pacing, sodium ceiling 1,800mg, potassium-rich whole foods.");
  }

  // 6. Evaluate Weight Loss Protocol
  if (isWeightLoss && !isPregnant) {
    calories = Math.max(1400, calories - 400); // Safe 400 kcal deficit
    protein = Math.max(protein, Math.round(weightKg * 1.8)); // 1.8g/kg for muscle retention
    steps = Math.max(steps, 10000);
    badges.push("Metabolic Caloric Deficit");
    notes.push("Structured 400 kcal deficit with high protein to protect lean muscle mass.");
  }

  // 7. Calculate Macronutrient Split
  let carbs = 0;
  let fat = 0;

  if (isDiabetic) {
    if (isPregnant) {
      // Gestational diabetes: 160-175g complex carbs distributed across 3 meals + 3 snacks
      carbs = 165;
      const remainingKcal = Math.max(500, calories - (protein * 4) - (carbs * 4));
      fat = Math.round(remainingKcal / 9);
    } else {
      // Diabetic carb ceiling: ~120-130g net carbs (or ~25-30% of kcal)
      carbs = Math.min(130, Math.round((calories * 0.28) / 4));
      const remainingKcal = Math.max(500, calories - (protein * 4) - (carbs * 4));
      fat = Math.round(remainingKcal / 9);
    }
  } else {
    // Standard / Pregnancy macro distribution
    fat = Math.round((calories * 0.28) / 9);
    carbs = Math.max(100, Math.round((calories - (protein * 4) - (fat * 9)) / 4));
  }

  return {
    stepsTarget: steps,
    calorieTarget: Math.round(calories),
    proteinTarget: Math.round(protein),
    carbsTarget: Math.max(60, carbs),
    fatTarget: Math.max(40, fat),
    waterTargetMl: waterMl,
    sodiumLimitMg: sodiumMg,
    clinicalBadges: badges.length > 0 ? badges : ["Standard Longevity"],
    clinicalNotes: notes,
  };
}

/**
 * Storage key for clinical health profile
 */
const STORAGE_KEY_CLINICAL = "lumen_clinical_profile";

/**
 * Reads stored clinical profile or returns defaults
 */
export async function getStoredClinicalProfile(): Promise<ClinicalProfile> {
  try {
    const raw = await storage.getItem(STORAGE_KEY_CLINICAL);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.conditions)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[ClinicalProfile] Load error:", err);
  }
  return DEFAULT_CLINICAL_PROFILE;
}

/**
 * Persists clinical profile to local storage
 */
export async function saveStoredClinicalProfile(profile: ClinicalProfile): Promise<void> {
  try {
    const payload = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    await storage.setItem(STORAGE_KEY_CLINICAL, JSON.stringify(payload));
  } catch (err) {
    console.warn("[ClinicalProfile] Save error:", err);
  }
}
