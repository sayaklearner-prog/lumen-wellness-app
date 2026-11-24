/**
 * CLINICAL SAFETY & DRUG CONTRAINDICATION ENGINE
 *
 * Evidence-based clinical pharmacology rules for Lumen Health OS:
 * - Real-time drug-allergy cross-reactivity checking
 * - Drug-condition contraindication screening (Hypertension, Diabetes, Pregnancy, Heart Failure)
 * - Drug-drug adverse interaction identification (Anticoagulants, ACEi + Potassium, etc.)
 *
 * 100% offline-first: runs instantaneously on device with zero external network dependency.
 */

export type SafetySeverity = "critical" | "high" | "moderate" | "safe";

export interface DrugContraindicationAlert {
  id: string;
  drug: string;
  conflictingItem: string;
  type: "drug_condition" | "drug_drug" | "drug_allergy";
  severity: SafetySeverity;
  title: string;
  description: string;
  clinicalGuidance: string;
}

export interface SafetyEvaluationResult {
  overallStatus: SafetySeverity;
  alerts: DrugContraindicationAlert[];
  checkedMedicationsCount: number;
  safeMedications: string[];
}

interface ClinicalDrugRule {
  drugKeywords: string[];
  canonicalName: string;
  drugDrugConflicts: {
    conflictingKeywords: string[];
    conflictingCanonical: string;
    severity: SafetySeverity;
    title: string;
    description: string;
    guidance: string;
  }[];
  conditionConflicts: {
    conditionKeywords: string[];
    conditionCanonical: string;
    severity: SafetySeverity;
    title: string;
    description: string;
    guidance: string;
  }[];
  allergyClasses: string[];
}

const CLINICAL_RULES_REGISTRY: ClinicalDrugRule[] = [
  // 1. NSAIDs (Ibuprofen, Naproxen, Meloxicam, Celebrex, Diclofenac)
  {
    drugKeywords: ["ibuprofen", "advil", "motrin", "naproxen", "aleve", "meloxicam", "celebrex", "diclofenac", "voltaren", "nsaid"],
    canonicalName: "NSAIDs",
    allergyClasses: ["nsaid", "aspirin", "ibuprofen", "naproxen"],
    drugDrugConflicts: [
      {
        conflictingKeywords: ["warfarin", "coumadin", "apixaban", "eliquis", "rivaroxaban", "xarelto", "heparin", "blood thinner"],
        conflictingCanonical: "Anticoagulants / Blood Thinners",
        severity: "critical",
        title: "Severe Bleeding & Hemorrhage Risk",
        description: "Concurrent use of NSAIDs and anticoagulants significantly multiplies gastrointestinal bleeding and hemorrhagic ulcer risks.",
        guidance: "Avoid concurrent use. Use Acetaminophen (Tylenol) for analgesia under physician guidance."
      },
      {
        conflictingKeywords: ["aspirin"],
        conflictingCanonical: "Aspirin",
        severity: "high",
        title: "Antiplatelet Competitive Inhibition & GI Risk",
        description: "Ibuprofen interferes with the cardioprotective antiplatelet effect of low-dose Aspirin and increases GI ulceration.",
        guidance: "Take Aspirin at least 2 hours before or 8 hours after Ibuprofen, or consult your cardiologist."
      },
      {
        conflictingKeywords: ["lisinopril", "enalapril", "losartan", "valsartan", "ace inhibitor", "arb"],
        conflictingCanonical: "ACE Inhibitors / ARBs",
        severity: "moderate",
        title: "Renal Hemodynamic Compromise & Blunted Antihypertensive Effect",
        description: "NSAIDs inhibit renal prostaglandins, reducing the blood pressure lowering efficacy of ACE inhibitors and stressing glomerular filtration.",
        guidance: "Monitor blood pressure and renal function. Limit NSAID duration to the minimum necessary."
      }
    ],
    conditionConflicts: [
      {
        conditionKeywords: ["hypertension", "high blood pressure", "htn"],
        conditionCanonical: "Hypertension",
        severity: "moderate",
        title: "Sodium Retention & Blood Pressure Spike",
        description: "NSAIDs promote renal sodium and water retention, potentially causing acute blood pressure elevation (+5 to 10 mmHg).",
        guidance: "Monitor blood pressure frequently. Consider non-NSAID analgesics."
      },
      {
        conditionKeywords: ["heart", "cardio", "heart failure", "chf"],
        conditionCanonical: "Cardiovascular Disease / Heart Failure",
        severity: "high",
        title: "Fluid Overload & Cardiovascular Strain",
        description: "NSAIDs can trigger congestive heart failure exacerbations due to fluid retention and increased systemic vascular resistance.",
        guidance: "Contraindicated in moderate-to-severe heart failure unless explicitly authorized by a cardiologist."
      },
      {
        conditionKeywords: ["kidney", "renal", "ckd", "nephro"],
        conditionCanonical: "Chronic Kidney Disease",
        severity: "critical",
        title: "Acute Renal Vasoconstriction Risk",
        description: "NSAIDs constrict renal afferent arterioles, precipitating acute kidney injury in vulnerable patients.",
        guidance: "Avoid all NSAIDs in chronic kidney disease."
      },
      {
        conditionKeywords: ["pregnancy", "pregnant", "gestational"],
        conditionCanonical: "Pregnancy",
        severity: "critical",
        title: "Premature Ductus Arteriosus Closure",
        description: "NSAID exposure in late pregnancy can cause premature closure of the fetal ductus arteriosus and oligohydramnios.",
        guidance: "Strictly contraindicated in pregnancy trimester 3. Acetaminophen is preferred under obstetrician care."
      }
    ]
  },

  // 2. ACE Inhibitors & ARBs (Lisinopril, Losartan, Enalapril, Valsartan)
  {
    drugKeywords: ["lisinopril", "prinivil", "zestril", "losartan", "cozaar", "enalapril", "valsartan", "diovan", "ramipril"],
    canonicalName: "ACE Inhibitors / ARBs",
    allergyClasses: ["ace inhibitor", "lisinopril", "arb"],
    drugDrugConflicts: [
      {
        conflictingKeywords: ["potassium", "spironolactone", "aldactone", "triamterene", "k-lor", "klor-con"],
        conflictingCanonical: "Potassium Supplements / K-Sparing Diuretics",
        severity: "critical",
        title: "Severe Hyperkalemia Risk",
        description: "Combining ACE inhibitors or ARBs with potassium supplements can cause serum potassium accumulation, triggering fatal cardiac arrhythmias.",
        guidance: "Routine serum potassium and creatinine monitoring required. Avoid OTC potassium supplements."
      }
    ],
    conditionConflicts: [
      {
        conditionKeywords: ["pregnancy", "pregnant", "gestational"],
        conditionCanonical: "Pregnancy",
        severity: "critical",
        title: "Black Box Teratogenic Warning: Fetal Renal Dysgenesis",
        description: "ACE inhibitors and ARBs act directly on the renin-angiotensin system, causing severe fetal injury, oligohydramnios, and death.",
        guidance: "Discontinue immediately upon pregnancy confirmation. Transition to Labetalol or Nifedipine under OB/GYN care."
      }
    ]
  },

  // 3. Metformin (Glucophage)
  {
    drugKeywords: ["metformin", "glucophage", "fortamet", "glumetza"],
    canonicalName: "Metformin",
    allergyClasses: ["metformin"],
    drugDrugConflicts: [
      {
        conflictingKeywords: ["contrast", "iodinated contrast", "ct scan dye"],
        conflictingCanonical: "Iodinated Radiocontrast",
        severity: "critical",
        title: "Contrast-Induced Nephropathy & Lactic Acidosis",
        description: "Intravascular iodinated contrast can cause acute renal failure leading to toxic Metformin accumulation and fatal lactic acidosis.",
        guidance: "Hold Metformin at the time of or prior to iodinated contrast imaging and for 48 hours post-procedure."
      }
    ],
    conditionConflicts: [
      {
        conditionKeywords: ["kidney", "renal", "ckd", "failure"],
        conditionCanonical: "Severe Renal Impairment",
        severity: "high",
        title: "Lactic Acidosis Toxicity Threshold",
        description: "Metformin clearance decreases with reduced eGFR (<30 mL/min/1.73m²), increasing the risk of potentially fatal lactic acidosis.",
        guidance: "Contraindicated if eGFR <30. Dose reduction required for eGFR 30-45."
      }
    ]
  },

  // 4. Beta-Blockers (Propranolol, Metoprolol, Atenolol, Carvedilol)
  {
    drugKeywords: ["propranolol", "inderal", "metoprolol", "lopressor", "toprol", "atenolol", "carvedilol", "coreg"],
    canonicalName: "Beta-Blockers",
    allergyClasses: ["beta blocker", "metoprolol"],
    drugDrugConflicts: [
      {
        conflictingKeywords: ["verapamil", "diltiazem"],
        conflictingCanonical: "Non-Dihydropyridine Calcium Channel Blockers",
        severity: "high",
        title: "Profound Bradycardia & AV Heart Block",
        description: "Concurrent negative inotropes/chronotropes cause additive suppression of SA and AV nodal conduction.",
        guidance: "Continuous ECG monitoring recommended if co-prescribed. Watch for syncope and severe bradycardia."
      }
    ],
    conditionConflicts: [
      {
        conditionKeywords: ["asthma", "copd", "bronchospasm", "wheezing"],
        conditionCanonical: "Severe Asthma / COPD",
        severity: "high",
        title: "Bronchospasm Risk via Beta-2 Blockade",
        description: "Non-selective beta-blockers block pulmonary beta-2 receptors, precipitating acute bronchoconstriction and blunting rescue inhalers.",
        guidance: "Prefer cardioselective beta-1 blockers (e.g. Bisoprolol) with pulmonary caution."
      },
      {
        conditionKeywords: ["diabetes", "t1d", "t2d", "hypoglycemia"],
        conditionCanonical: "Diabetes / Hypoglycemia",
        severity: "moderate",
        title: "Masking of Autonomic Hypoglycemia Warning Signs",
        description: "Beta-blockers attenuate sympathetic hypoglycemia indicators (tachycardia, tremors), leaving diaphoresis as the sole symptom.",
        guidance: "Educate patient on recognizing sweating as primary hypoglycemia indicator. Wear continuous glucose monitor (CGM)."
      }
    ]
  },

  // 5. Statins (Atorvastatin, Rosuvastatin, Simvastatin)
  {
    drugKeywords: ["atorvastatin", "lipitor", "rosuvastatin", "crestor", "simvastatin", "zocor", "pravastatin"],
    canonicalName: "HMG-CoA Reductase Inhibitors (Statins)",
    allergyClasses: ["statin", "atorvastatin"],
    drugDrugConflicts: [
      {
        conflictingKeywords: ["gemfibrozil", "lopid"],
        conflictingCanonical: "Gemfibrozil (Fibrate)",
        severity: "high",
        title: "Severe Rhabdomyolysis & Myopathy Risk",
        description: "Gemfibrozil inhibits statin glucuronidation, driving massive plasma statin levels and severe skeletal muscle necrosis.",
        guidance: "Avoid concurrent use. Prefer Fenofibrate with lower interaction risk, or Ezetimibe."
      }
    ],
    conditionConflicts: [
      {
        conditionKeywords: ["pregnancy", "pregnant", "gestational"],
        conditionCanonical: "Pregnancy",
        severity: "critical",
        title: "Disruption of Fetal Cholesterol Synthesis",
        description: "Cholesterol is critical for fetal membrane development. Statins are historically contraindicated during gestation.",
        guidance: "Discontinue statin therapy when attempting conception or during pregnancy."
      }
    ]
  },

  // 6. Penicillin & Beta-Lactam Antibiotics
  {
    drugKeywords: ["penicillin", "amoxicillin", "augmentin", "ampicillin", "piperacillin", "zosyn"],
    canonicalName: "Penicillin Antibiotics",
    allergyClasses: ["penicillin", "amoxicillin", "beta-lactam"],
    drugDrugConflicts: [],
    conditionConflicts: []
  }
];

/**
 * Normalizes input string for fuzzy keyword comparison.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

/**
 * Checks if a drug string matches any keywords in a rule.
 */
function drugMatchesKeywords(drugString: string, keywords: string[]): boolean {
  const normalized = normalizeText(drugString);
  const words = normalized.split(/\s+/);
  return keywords.some((kw) => {
    const kwNorm = normalizeText(kw);
    return normalized.includes(kwNorm) || words.includes(kwNorm);
  });
}

/**
 * Evaluates patient medications against active conditions, allergies, and concurrent drugs.
 */
export function evaluateMedicationSafety(
  medications: string[],
  conditions: string[],
  allergies: string[]
): SafetyEvaluationResult {
  const alerts: DrugContraindicationAlert[] = [];
  const safeMedications: string[] = [];

  const normAllergies = allergies.map(normalizeText);
  const normConditions = conditions.map(normalizeText);

  medications.forEach((med, medIndex) => {
    let hasAlertForMed = false;

    for (const rule of CLINICAL_RULES_REGISTRY) {
      if (!drugMatchesKeywords(med, rule.drugKeywords)) continue;

      // 1. Check Drug-Allergy Cross-Reactivity
      for (const allergyClass of rule.allergyClasses) {
        const matchingAllergy = allergies.find((allergy) =>
          normalizeText(allergy).includes(allergyClass) || allergyClass.includes(normalizeText(allergy))
        );
        if (matchingAllergy) {
          hasAlertForMed = true;
          alerts.push({
            id: `allergy-${rule.canonicalName}-${medIndex}`,
            drug: med,
            conflictingItem: matchingAllergy,
            type: "drug_allergy",
            severity: "critical",
            title: `Severe Allergy Cross-Reactivity: ${matchingAllergy}`,
            description: `${med} belongs to or cross-reacts with the ${matchingAllergy} allergy class. Exposure could trigger immediate hypersensitivity or anaphylaxis.`,
            clinicalGuidance: "Do not administer. Immediate physician/pharmacist substitution required."
          });
        }
      }

      // 2. Check Drug-Condition Contraindications
      for (const condConflict of rule.conditionConflicts) {
        const matchingCondition = conditions.find((cond) =>
          condConflict.conditionKeywords.some((kw) => normalizeText(cond).includes(kw))
        );
        if (matchingCondition) {
          hasAlertForMed = true;
          alerts.push({
            id: `condition-${rule.canonicalName}-${condConflict.conditionCanonical}-${medIndex}`,
            drug: med,
            conflictingItem: matchingCondition,
            type: "drug_condition",
            severity: condConflict.severity,
            title: `${condConflict.title} (${matchingCondition})`,
            description: condConflict.description,
            clinicalGuidance: condConflict.guidance
          });
        }
      }

      // 3. Check Drug-Drug Adverse Interactions against remaining medications
      medications.forEach((otherMed, otherIndex) => {
        if (medIndex >= otherIndex) return; // avoid duplicate pairs

        for (const ddConflict of rule.drugDrugConflicts) {
          if (drugMatchesKeywords(otherMed, ddConflict.conflictingKeywords)) {
            hasAlertForMed = true;
            alerts.push({
              id: `drugdrug-${medIndex}-${otherIndex}`,
              drug: med,
              conflictingItem: otherMed,
              type: "drug_drug",
              severity: ddConflict.severity,
              title: ddConflict.title,
              description: ddConflict.description,
              clinicalGuidance: ddConflict.guidance
            });
          }
        }
      });
    }

    if (!hasAlertForMed) {
      safeMedications.push(med);
    }
  });

  // Calculate highest severity
  let overallStatus: SafetySeverity = "safe";
  if (alerts.some((a) => a.severity === "critical")) {
    overallStatus = "critical";
  } else if (alerts.some((a) => a.severity === "high")) {
    overallStatus = "high";
  } else if (alerts.some((a) => a.severity === "moderate")) {
    overallStatus = "moderate";
  }

  return {
    overallStatus,
    alerts,
    checkedMedicationsCount: medications.length,
    safeMedications
  };
}
