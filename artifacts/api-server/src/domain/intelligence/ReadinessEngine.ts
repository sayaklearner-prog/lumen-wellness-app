export interface ReadinessFeatures {
  sleepHours: number;
  sleepQuality: number;
  acuteTrainingLoad: number; // e.g. active minutes today
  chronicTrainingLoad: number; // e.g. avg active minutes last 7 days
}

export abstract class BaseReadinessEngine {
  /**
   * Calculates a readiness score from 0 to 10.
   */
  abstract calculateScore(features: ReadinessFeatures): number;
}

export class HeuristicReadinessEngine extends BaseReadinessEngine {
  calculateScore(features: ReadinessFeatures): number {
    let score = 5.0; // baseline

    // Sleep impact
    if (features.sleepHours > 7.5) score += 3.0;
    else if (features.sleepHours > 6.0) score += 1.0;
    else if (features.sleepHours < 5.0) score -= 3.0;

    // Quality modifier
    score *= features.sleepQuality;

    // Training load impact (Acute:Chronic Workload Ratio - ACWR)
    const acwr = features.chronicTrainingLoad > 0 
      ? features.acuteTrainingLoad / features.chronicTrainingLoad 
      : 1.0;
    
    if (acwr > 1.5) {
      // Danger zone
      score -= 2.0;
    } else if (acwr < 0.8) {
      // Detraining
      score -= 0.5;
    } else {
      // Sweet spot
      score += 1.0;
    }

    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  }
}

export const readinessEngine = new HeuristicReadinessEngine();
