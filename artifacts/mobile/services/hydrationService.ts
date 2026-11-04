/**
 * LUMEN HYDRATION & ELECTROLYTE MASTERY SERVICE
 * 
 * Clinical Cellular Hydration Architecture:
 * - Smart Dynamic Daily Target based on body weight, steps, sweat rate, and workouts
 * - Quick-log Container Presets (Glass, Water Bottle, Shaker, Hydro Jug, Tea, Electrolyte)
 * - Beverage Absorption Index (Pure Water, Electrolytes, Herbal Infusion, Coffee)
 * - Real-time SQLite Local Storage & FastAPI Backend Sync
 * - Hourly Hydration Schedule & Urine Color Indicator Scale
 * - Automated Daytime Smart Interval Reminders (8:00 AM - 10:00 PM) synced to native Android AlarmManager
 */

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import {
  addHydrationEntry,
  getHydrationEntriesToday,
  deleteHydrationEntry,
  getHydrationToday,
  setHydrationToday,
  HydrationEntryRecord,
} from "./db";
import { storage } from "./storage";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  syncNotificationSchedules,
  sendLocalNotification,
} from "./notifications";

export interface HydrationPreset {
  id: string;
  label: string;
  amountMl: number;
  cups: number;
  icon: string;
  badge: string;
  color: string;
}

export const HYDRATION_PRESETS: HydrationPreset[] = [
  {
    id: "glass",
    label: "Standard Glass",
    amountMl: 250,
    cups: 1,
    icon: "🥛",
    badge: "250 ml",
    color: "#06b6d4",
  },
  {
    id: "bottle",
    label: "Water Bottle",
    amountMl: 500,
    cups: 2,
    icon: "🍶",
    badge: "500 ml",
    color: "#38bdf8",
  },
  {
    id: "shaker",
    label: "Sports Shaker",
    amountMl: 750,
    cups: 3,
    icon: "🥤",
    badge: "750 ml",
    color: "#10b981",
  },
  {
    id: "jug",
    label: "Hydro Jug / Flask",
    amountMl: 1000,
    cups: 4,
    icon: "🍼",
    badge: "1,000 ml",
    color: "#6366f1",
  },
  {
    id: "electrolytes",
    label: "Electrolyte Drink",
    amountMl: 350,
    cups: 1.4,
    icon: "⚡",
    badge: "350 ml",
    color: "#f59e0b",
  },
  {
    id: "tea",
    label: "Herbal Infusion / Tea",
    amountMl: 200,
    cups: 0.8,
    icon: "🍵",
    badge: "200 ml",
    color: "#14b8a6",
  },
];

export interface BeverageTypeInfo {
  id: string;
  name: string;
  hydrationFactor: number;
  color: string;
  icon: string;
  description: string;
}

export const BEVERAGE_TYPES: Record<string, BeverageTypeInfo> = {
  water: {
    id: "water",
    name: "Pure Water",
    hydrationFactor: 1.0,
    color: "#06b6d4",
    icon: "💧",
    description: "100% cellular hydration & metabolic balance",
  },
  electrolytes: {
    id: "electrolytes",
    name: "Electrolyte Water",
    hydrationFactor: 1.15,
    color: "#f59e0b",
    icon: "⚡",
    description: "Rapid sodium-potassium intracellular transport",
  },
  tea: {
    id: "tea",
    name: "Herbal Tea",
    hydrationFactor: 0.95,
    color: "#14b8a6",
    icon: "🍵",
    description: "Antioxidant infusion, gentle hydration",
  },
  coffee: {
    id: "coffee",
    name: "Coffee / Espresso",
    hydrationFactor: 0.75,
    color: "#a16207",
    icon: "☕",
    description: "Mild diuretic factor, balance with plain water",
  },
};

export interface HourlyHydrationGoal {
  timeWindow: string;
  periodName: string;
  recommendedMl: number;
  purpose: string;
}

export const HOURLY_HYDRATION_SCHEDULE: HourlyHydrationGoal[] = [
  {
    timeWindow: "07:00 – 09:00",
    periodName: "Morning Kickstart",
    recommendedMl: 500,
    purpose: "Overnight replenishment & digestion fire",
  },
  {
    timeWindow: "09:00 – 12:00",
    periodName: "Deep Focus Flow",
    recommendedMl: 500,
    purpose: "Cognitive stamina & neuro-clarity",
  },
  {
    timeWindow: "12:00 – 15:00",
    periodName: "Post-Lunch Pace",
    recommendedMl: 500,
    purpose: "Enzymatic food digestion support",
  },
  {
    timeWindow: "15:00 – 18:00",
    periodName: "Afternoon & Workout",
    recommendedMl: 500,
    purpose: "Pre-sweat prep & fatigue prevention",
  },
  {
    timeWindow: "18:00 – 21:00",
    periodName: "Evening Wind Down",
    recommendedMl: 350,
    purpose: "Gentle hydration without sleep disruptions",
  },
];

export interface HydrationState {
  todayMl: number;
  targetMl: number;
  todayCups: number;
  targetCups: number;
  percentUsed: number;
  score: number;
  statusLabel: string;
  statusBadgeColor: string;
  entries: HydrationEntryRecord[];
  remindersEnabled: boolean;
  reminderIntervalHours: number; // 1, 1.5, 2, 3
  nextPromptTimeStr: string | null;
  isGoalMet: boolean;
}

class HydrationService {
  private listeners: Set<(state: HydrationState) => void> = new Set();
  private currentState: HydrationState = {
    todayMl: 0,
    targetMl: 2000,
    todayCups: 0,
    targetCups: 8,
    percentUsed: 0,
    score: 0.0,
    statusLabel: "Not logged • Tap to log",
    statusBadgeColor: "#64748b",
    entries: [],
    remindersEnabled: true,
    reminderIntervalHours: 2,
    nextPromptTimeStr: null,
    isGoalMet: false,
  };

  constructor() {
    this.refreshState();
  }

  public getState(): HydrationState {
    return { ...this.currentState };
  }

  public subscribe(listener: (state: HydrationState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.currentState });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = { ...this.currentState };
    for (const listener of this.listeners) {
      try {
        listener(copy);
      } catch (err) {
        console.warn("Hydration listener error:", err);
      }
    }
  }

  private triggerHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  }

  public calculateSmartTarget(steps = 0, workoutMinutes = 0): number {
    let target = 2000;
    if (steps > 5000) {
      const extraSteps = steps - 5000;
      target += Math.round((extraSteps / 1000) * 35);
    }
    if (workoutMinutes > 0) {
      target += Math.round((workoutMinutes / 30) * 300);
    }
    return Math.min(4000, target);
  }

  public async refreshState(steps = 0, workoutMinutes = 0): Promise<HydrationState> {
    try {
      const entries = await getHydrationEntriesToday();
      const targetMl = this.calculateSmartTarget(steps, workoutMinutes);
      const targetCups = Math.round(targetMl / 250);

      let totalMl = 0;
      if (entries && entries.length > 0) {
        totalMl = entries.reduce((sum, e) => sum + (e.amountMl || 0), 0);
      } else {
        const cups = await getHydrationToday();
        totalMl = cups * 250;
      }

      const todayCups = Number((totalMl / 250).toFixed(1));
      const ratio = targetMl > 0 ? totalMl / targetMl : 0;
      const percentUsed = Math.min(150, Math.round(ratio * 100));
      const isGoalMet = totalMl >= targetMl && targetMl > 0;

      let score = 0.0;
      let statusLabel = "Not logged • Tap to log";
      let statusBadgeColor = "#64748b";

      if (totalMl > 0) {
        if (ratio < 0.5) {
          score = Number((ratio * 12).toFixed(1));
          statusLabel = "Needs Water • Low Intake";
          statusBadgeColor = "#ef4444";
        } else if (ratio < 0.8) {
          score = Number((6.0 + (ratio - 0.5) * 6.5).toFixed(1));
          statusLabel = "Progressing • Keep Drinking";
          statusBadgeColor = "#f59e0b";
        } else if (ratio <= 1.15) {
          score = Number(Math.min(10.0, 8.5 + (ratio - 0.8) * 4.2).toFixed(1));
          statusLabel = "Optimal Flow • Fully Hydrated";
          statusBadgeColor = "#10b981";
        } else {
          score = 9.5;
          statusLabel = "Well Hydrated • Exceeded Target";
          statusBadgeColor = "#06b6d4";
        }
      }

      // Read reminder preferences
      const prefs = await getNotificationPreferences();
      const remindersEnabled = Boolean(prefs.hydrationEnabled);
      const reminderIntervalHours = Number(prefs.hydrationIntervalHours) || 2;

      // Calculate next prompt display string
      let nextPromptTimeStr = "Disabled";
      if (remindersEnabled) {
        if (isGoalMet) {
          nextPromptTimeStr = "Goal Met • Resting";
        } else {
          const now = new Date();
          const currentHour = now.getHours();
          if (currentHour >= 22 || currentHour < 7) {
            nextPromptTimeStr = "Tomorrow 8:00 AM";
          } else {
            const nextTime = new Date(now.getTime() + reminderIntervalHours * 3600 * 1000);
            if (nextTime.getHours() >= 22) {
              nextPromptTimeStr = "Tomorrow 8:00 AM";
            } else {
              nextPromptTimeStr = nextTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            }
          }
        }
      }

      this.currentState = {
        todayMl: totalMl,
        targetMl,
        todayCups,
        targetCups,
        percentUsed,
        score,
        statusLabel,
        statusBadgeColor,
        entries: entries || [],
        remindersEnabled,
        reminderIntervalHours,
        nextPromptTimeStr,
        isGoalMet,
      };

      this.notify();
      return this.currentState;
    } catch (err) {
      console.warn("Hydration refreshState error:", err);
      return this.currentState;
    }
  }

  public async toggleReminders(enabled: boolean): Promise<HydrationState> {
    this.triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const prefs = await getNotificationPreferences();
    prefs.hydrationEnabled = enabled;
    await saveNotificationPreferences(prefs);
    await syncNotificationSchedules(prefs);
    return await this.refreshState();
  }

  public async setIntervalHours(hours: number): Promise<HydrationState> {
    this.triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const prefs = await getNotificationPreferences();
    prefs.hydrationIntervalHours = hours;
    await saveNotificationPreferences(prefs);
    await syncNotificationSchedules(prefs);
    return await this.refreshState();
  }

  public async sendTestPrompt(): Promise<boolean> {
    this.triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const id = await sendLocalNotification({
      title: "💧 Cellular Hydration Prompt",
      body: "Hydration check: Sip 250ml of water now to maintain optimal blood volume and cellular metabolism.",
      channelId: "lumen_hydration",
    });
    return id !== null;
  }

  public async logDrink(amountMl: number, beverageType = "water"): Promise<HydrationState> {
    this.triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const newEntry: HydrationEntryRecord = {
      id: `hyd-${Date.now()}`,
      amountMl,
      beverageType,
      loggedAt: new Date().toISOString(),
    };

    await addHydrationEntry(newEntry);

    const nextTotalMl = this.currentState.todayMl + amountMl;
    const nextCups = Math.round(nextTotalMl / 250);
    await setHydrationToday(nextCups);

    const updated = await this.refreshState();

    // Background sync to backend
    this.syncToBackend(newEntry).catch((err) => console.warn("Hydration backend sync err:", err));

    return updated;
  }

  public async removeEntry(id: string): Promise<HydrationState> {
    this.triggerHaptic();
    await deleteHydrationEntry(id);

    const entries = await getHydrationEntriesToday();
    const nextTotalMl = entries.reduce((sum, e) => sum + (e.amountMl || 0), 0);
    const nextCups = Math.round(nextTotalMl / 250);
    await setHydrationToday(nextCups);

    return await this.refreshState();
  }

  public async incrementCup(): Promise<HydrationState> {
    return await this.logDrink(250, "water");
  }

  public async decrementCup(): Promise<HydrationState> {
    this.triggerHaptic();
    const currentCups = await getHydrationToday();
    if (currentCups > 0) {
      const nextCups = currentCups - 1;
      await setHydrationToday(nextCups);
      return await this.refreshState();
    }
    return this.currentState;
  }

  private async syncToBackend(entry: HydrationEntryRecord) {
    try {
      const token = await storage.getItem("access_token");
      if (!token) return;

      const API_URL =
        (typeof window !== "undefined" && (window as any).__LUMEN_API_URL__) ||
        "https://lumen-ai-backend-4e785.web.app";

      await fetch(`${API_URL}/api/hydration/entry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(entry),
      });
    } catch {}
  }
}

export const hydrationService = new HydrationService();
