export interface HabitHistory {
  daysTracked: number;
  completions: number;
  currentStreak: number;
}

export abstract class BaseHabitEngine {
  abstract calculateHabitScore(history: HabitHistory): number;
  abstract predictFailureRisk(history: HabitHistory): string; // "LOW" | "MEDIUM" | "HIGH"
}

export class HeuristicHabitEngine extends BaseHabitEngine {
  calculateHabitScore(history: HabitHistory): number {
    if (history.daysTracked === 0) return 0;
    const consistency = history.completions / history.daysTracked;
    const streakBonus = Math.min(history.currentStreak * 0.5, 2.0);
    return Math.max(0, Math.min(10, (consistency * 8) + streakBonus));
  }

  predictFailureRisk(history: HabitHistory): string {
    if (history.currentStreak > 7) return "LOW";
    if (history.daysTracked > 14 && (history.completions / history.daysTracked) < 0.5) return "HIGH";
    return "MEDIUM";
  }
}

export const habitEngine = new HeuristicHabitEngine();
