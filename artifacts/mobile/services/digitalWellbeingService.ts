/**
 * LUMEN DIGITAL WELLBEING & FOCUS MODE SERVICE
 * 
 * Inspired by Mindful (Digital Wellbeing & Screen Time Android Architecture):
 * - Direct Bridge to Android's Native UsageStatsManager & AppOpsManager via DigitalWellbeingPlugin
 * - Real Screen Time & App Usage Telemetry (YouTube, Instagram, WhatsApp, Chrome, etc.)
 * - Automatic App Categorization: Productivity, Social, Entertainment, Gaming, Other
 * - Real Screen Unlocks counter & Digital Balance scoring
 * - Android Do Not Disturb (DND) Integration & Native Focus Notifications
 * - Distracting App Preset Blocklists & Installed Apps selector
 * - Local SQLite Caching & Backend Synchronization
 */

import { Platform, Linking, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import {
  saveFocusSession,
  getFocusSessionsToday,
  FocusSessionRecord,
  getWellbeingConfig,
  saveWellbeingConfig,
  WellbeingConfigRecord,
  getScreenTimeToday,
  saveScreenTime,
  ScreenTimeRecord,
} from "./db";
import { storage } from "./storage";

// ============================================================================
// 1. DATA MODELS & TELEMETRY
// ============================================================================

export interface AppUsageDetail {
  packageName: string;
  appName: string;
  screenSeconds: number;
  screenMinutes: number;
  category: "productivity" | "social" | "entertainment" | "gaming" | "other";
  icon?: string; // data:image/png;base64,...
}

export interface ScreenCategoryDetail {
  minutes: number;
  percentage: number;
}

export interface ScreenTimeTelemetry {
  permissionGranted: boolean;
  totalScreenSeconds: number;
  totalScreenMinutes: number;
  unlockCount: number;
  categories: {
    productivity: ScreenCategoryDetail;
    social: ScreenCategoryDetail;
    entertainment: ScreenCategoryDetail;
    gaming: ScreenCategoryDetail;
    other: ScreenCategoryDetail;
  };
  apps: AppUsageDetail[];
  syncedAt?: string;
}

export interface InstalledAppItem {
  packageName: string;
  appName: string;
  category: string;
}

export interface MindfulQuote {
  author: string;
  text: string;
}

export const MINDFUL_QUOTES: MindfulQuote[] = [
  {
    author: "Thich Nhat Hanh",
    text: "The present moment is filled with joy and happiness. If you are attentive, you will see it.",
  },
  {
    author: "Anne Lamott",
    text: "Almost everything will work again if you unplug it for a few minutes, including you.",
  },
  {
    author: "Cal Newport",
    text: "Clarity about what matters provides clarity about what does not.",
  },
  {
    author: "Cal Newport",
    text: "Your attention is your currency; spend it wisely.",
  },
  {
    author: "Pico Iyer",
    text: "In an age of distraction, nothing can feel more luxurious than paying attention.",
  },
  {
    author: "Eckhart Tolle",
    text: "Realize deeply that the present moment is all you have. Make the NOW the primary focus.",
  },
  {
    author: "Marcus Aurelius",
    text: "Ask yourself at every moment, 'Is this necessary?'",
  },
  {
    author: "Seneca",
    text: "To be everywhere is to be nowhere.",
  },
  {
    author: "William James",
    text: "The greatest weapon against stress is our ability to choose one thought over another.",
  },
  {
    author: "Rumi",
    text: "The quieter you become, the more you can hear.",
  },
  {
    author: "Jon Kabat-Zinn",
    text: "The best way to capture moments is to pay attention. This is how we cultivate mindfulness.",
  },
  {
    author: "Sherry Turkle",
    text: "Technology challenges us to assert our human values; offline is where we rediscover them.",
  },
  {
    author: "Joshua Becker",
    text: "Simplify your life by simplifying your screens.",
  },
  {
    author: "Arianna Huffington",
    text: "Disconnecting from technology to reconnect with ourselves is essential for wisdom.",
  },
  {
    author: "Tara Brach",
    text: "The invitation of mindfulness is to recognize that every moment is an opportunity to awaken.",
  },
  {
    author: "Simon Sinek",
    text: "There is a difference between being connected and being present.",
  },
  {
    author: "Deepak Chopra",
    text: "In the midst of movement and chaos, keep stillness inside of you.",
  },
  {
    author: "Arthur Ashe",
    text: "Start where you are. Use what you have. Do what you can.",
  },
];

export function getRandomMindfulQuote(): MindfulQuote {
  const index = Math.floor(Math.random() * MINDFUL_QUOTES.length);
  return MINDFUL_QUOTES[index];
}

// ============================================================================
// 2. DISTRACTING APP CATEGORIES & PRESETS
// ============================================================================

export interface DistractingCategory {
  id: string;
  name: string;
  iconName: string;
  description: string;
  sampleApps: string[];
}

export const DISTRACTING_CATEGORIES: DistractingCategory[] = [
  {
    id: "social",
    name: "Social Media",
    iconName: "Share2",
    description: "Instagram, TikTok, X (Twitter), Facebook, Snapchat",
    sampleApps: ["Instagram", "TikTok", "Twitter/X", "Facebook", "Snapchat"],
  },
  {
    id: "video",
    name: "Streaming & Shorts",
    iconName: "Film",
    description: "YouTube, Netflix, Twitch, Disney+, Prime Video",
    sampleApps: ["YouTube", "Netflix", "Twitch", "Disney+"],
  },
  {
    id: "games",
    name: "Gaming & Arcade",
    iconName: "Gamepad2",
    description: "Mobile games, puzzles, casino, action",
    sampleApps: ["Candy Crush", "Roblox", "Subway Surfers", "PUBG"],
  },
  {
    id: "messaging",
    name: "Chat & Messaging",
    iconName: "MessageCircle",
    description: "WhatsApp, Discord, Telegram, Messenger",
    sampleApps: ["WhatsApp", "Telegram", "Discord", "Messenger"],
  },
  {
    id: "shopping",
    name: "Shopping & Retail",
    iconName: "ShoppingBag",
    description: "Amazon, Shein, eBay, Temu, AliExpress",
    sampleApps: ["Amazon", "Shein", "eBay", "Temu"],
  },
];

export type FocusSessionType = "pomodoro" | "deep_work" | "quick_focus" | "flow_state" | "custom";

export interface FocusPreset {
  type: FocusSessionType;
  title: string;
  minutes: number;
  description: string;
  accentColor: string;
}

export const FOCUS_PRESETS: FocusPreset[] = [
  {
    type: "quick_focus",
    title: "Quick Focus",
    minutes: 15,
    description: "Short sprint for single urgent tasks",
    accentColor: "#38bdf8",
  },
  {
    type: "pomodoro",
    title: "Classic Pomodoro",
    minutes: 25,
    description: "Standard interval for focused deep bursts",
    accentColor: "#a855f7",
  },
  {
    type: "deep_work",
    title: "Deep Work",
    minutes: 45,
    description: "Extended flow state with zero notifications",
    accentColor: "#10b981",
  },
  {
    type: "flow_state",
    title: "Ultra Flow",
    minutes: 60,
    description: "High-intensity uninterrupted research or code",
    accentColor: "#f59e0b",
  },
];

export interface LiveFocusState {
  isActive: boolean;
  isPaused: boolean;
  sessionType: FocusSessionType;
  targetSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
  blockedCategories: string[];
  currentQuote: MindfulQuote;
  startedAtTimestamp: number;
}

// ============================================================================
// 3. CAPACITOR BRIDGE
// ============================================================================

interface DigitalWellbeingNativePlugin {
  checkUsagePermission(): Promise<{ granted: boolean; apiLevel: number }>;
  requestUsagePermission(): Promise<{ requested: boolean }>;
  checkDndPermission(): Promise<{ granted: boolean }>;
  requestDndPermission(): Promise<{ requested: boolean }>;
  setDndMode(options: { enabled: boolean }): Promise<{ success: boolean; enabled: boolean }>;
  getTodayScreenTime(): Promise<{
    permissionGranted: boolean;
    totalScreenSeconds: number;
    totalScreenMinutes: number;
    unlockCount: number;
    categories: {
      productivity: ScreenCategoryDetail;
      social: ScreenCategoryDetail;
      entertainment: ScreenCategoryDetail;
      gaming: ScreenCategoryDetail;
      other: ScreenCategoryDetail;
    };
    apps: AppUsageDetail[];
  }>;
  getInstalledApps(): Promise<{ apps: InstalledAppItem[] }>;
  startFocusSession(options: {
    sessionType: string;
    minutes: number;
    enableDnd: boolean;
  }): Promise<{ success: boolean }>;
  stopFocusSession(): Promise<{ success: boolean }>;
}

const getCapacitor = () => {
  if (typeof window !== "undefined" && (window as any).Capacitor) {
    return (window as any).Capacitor;
  }
  return null;
};

const getNativePlugin = (): DigitalWellbeingNativePlugin | null => {
  const cap = getCapacitor();
  if (cap && cap.Plugins && cap.Plugins.DigitalWellbeing) {
    return cap.Plugins.DigitalWellbeing as DigitalWellbeingNativePlugin;
  }
  return null;
};

// ============================================================================
// 4. MAIN DIGITAL WELLBEING SERVICE CLASS
// ============================================================================

class DigitalWellbeingService {
  private timerRef: any = null;
  private focusListeners: Set<(state: LiveFocusState) => void> = new Set();
  private telemetryListeners: Set<(telemetry: ScreenTimeTelemetry) => void> = new Set();

  private currentTelemetry: ScreenTimeTelemetry = {
    permissionGranted: false,
    totalScreenSeconds: 0,
    totalScreenMinutes: 0,
    unlockCount: 0,
    categories: {
      productivity: { minutes: 0, percentage: 0 },
      social: { minutes: 0, percentage: 0 },
      entertainment: { minutes: 0, percentage: 0 },
      gaming: { minutes: 0, percentage: 0 },
      other: { minutes: 0, percentage: 0 },
    },
    apps: [],
  };

  private currentState: LiveFocusState = {
    isActive: false,
    isPaused: false,
    sessionType: "pomodoro",
    targetSeconds: 25 * 60,
    elapsedSeconds: 0,
    remainingSeconds: 25 * 60,
    progressPercent: 0,
    blockedCategories: ["social", "video", "games"],
    currentQuote: getRandomMindfulQuote(),
    startedAtTimestamp: 0,
  };

  constructor() {
    this.restoreSessionIfActive();
    this.loadCachedTelemetry();
  }

  public getState(): LiveFocusState {
    return { ...this.currentState };
  }

  public getTelemetry(): ScreenTimeTelemetry {
    return { ...this.currentTelemetry };
  }

  public subscribe(listener: (state: LiveFocusState) => void): () => void {
    this.focusListeners.add(listener);
    listener({ ...this.currentState });
    return () => {
      this.focusListeners.delete(listener);
    };
  }

  public subscribeTelemetry(listener: (telemetry: ScreenTimeTelemetry) => void): () => void {
    this.telemetryListeners.add(listener);
    listener({ ...this.currentTelemetry });
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  private notifyFocus() {
    const copy = { ...this.currentState };
    for (const listener of this.focusListeners) {
      try {
        listener(copy);
      } catch (err) {
        console.warn("Focus listener error:", err);
      }
    }
  }

  private notifyTelemetry() {
    const copy = { ...this.currentTelemetry };
    for (const listener of this.telemetryListeners) {
      try {
        listener(copy);
      } catch (err) {
        console.warn("Telemetry listener error:", err);
      }
    }
  }

  private triggerHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(style);
      }
    } catch {}
  }

  private async loadCachedTelemetry() {
    try {
      const cached = await getScreenTimeToday();
      if (cached) {
        this.currentTelemetry = {
          ...this.currentTelemetry,
          totalScreenMinutes: cached.screenMinutes,
          totalScreenSeconds: cached.screenMinutes * 60,
          categories: {
            productivity: { minutes: cached.productivityMinutes, percentage: 0 },
            social: { minutes: cached.socialMinutes, percentage: 0 },
            entertainment: { minutes: cached.mediaMinutes, percentage: 0 },
            gaming: { minutes: 0, percentage: 0 },
            other: { minutes: cached.wellbeingMinutes, percentage: 0 },
          },
          syncedAt: cached.loggedAt,
        };
        this.notifyTelemetry();
      }
    } catch {}
  }

  // ============================================================================
  // 5. NATIVE ANDROID PERMISSION CHECKS & REQUESTS
  // ============================================================================

  public async checkUsagePermission(): Promise<{ granted: boolean }> {
    const native = getNativePlugin();
    if (native) {
      try {
        const res = await native.checkUsagePermission();
        this.currentTelemetry.permissionGranted = res.granted;
        this.notifyTelemetry();
        return res;
      } catch (err) {
        console.warn("Error calling native checkUsagePermission:", err);
      }
    }
    return { granted: false };
  }

  public async requestUsagePermission(): Promise<void> {
    this.triggerHaptic();
    const native = getNativePlugin();
    if (native) {
      try {
        await native.requestUsagePermission();
        return;
      } catch (err) {
        console.warn("Error calling native requestUsagePermission:", err);
      }
    }
    // Fallback to deep link intent
    await this.openUsageAccessSettings();
  }

  public async checkDndPermission(): Promise<{ granted: boolean }> {
    const native = getNativePlugin();
    if (native) {
      try {
        return await native.checkDndPermission();
      } catch {}
    }
    return { granted: false };
  }

  public async requestDndPermission(): Promise<void> {
    this.triggerHaptic();
    const native = getNativePlugin();
    if (native) {
      try {
        await native.requestDndPermission();
        return;
      } catch {}
    }
    await this.openDndSettings();
  }

  public async setDndMode(enabled: boolean): Promise<boolean> {
    const native = getNativePlugin();
    if (native) {
      try {
        const res = await native.setDndMode({ enabled });
        return res.success;
      } catch {}
    }
    return false;
  }

  // ============================================================================
  // 6. REAL SCREEN TIME TELEMETRY SYNC
  // ============================================================================

  /**
   * Fetches real phone screen time and app usage from Android UsageStatsManager
   */
  public async fetchTodayScreenTime(): Promise<ScreenTimeTelemetry> {
    const native = getNativePlugin();

    if (native) {
      try {
        const res = await native.getTodayScreenTime();

        this.currentTelemetry = {
          permissionGranted: res.permissionGranted,
          totalScreenSeconds: res.totalScreenSeconds,
          totalScreenMinutes: res.totalScreenMinutes,
          unlockCount: res.unlockCount,
          categories: res.categories,
          apps: res.apps || [],
          syncedAt: new Date().toISOString(),
        };

        if (res.permissionGranted && res.totalScreenMinutes >= 0) {
          // Persist to local SQLite
          const config = await getWellbeingConfig();
          const screenRecord: ScreenTimeRecord = {
            id: `screen-${new Date().toISOString().slice(0, 10)}`,
            screenMinutes: res.totalScreenMinutes,
            limitMinutes: config.dailyLimitMinutes || 240,
            productivityMinutes: res.categories.productivity.minutes,
            socialMinutes: res.categories.social.minutes,
            mediaMinutes: res.categories.entertainment.minutes,
            wellbeingMinutes: res.categories.other.minutes,
            focusMode: this.currentState.isActive,
            windDown: false,
            loggedAt: new Date().toISOString(),
          };
          await saveScreenTime(screenRecord);

          // Sync to Backend
          this.syncTelemetryToBackend(this.currentTelemetry).catch((err) =>
            console.warn("Background screen sync err:", err)
          );
        }

        this.notifyTelemetry();
        return this.currentTelemetry;
      } catch (err) {
        console.warn("Failed to fetch native screen time:", err);
      }
    }

    // Fallback: load SQLite cached record
    await this.loadCachedTelemetry();
    return this.currentTelemetry;
  }

  public async getInstalledApps(): Promise<InstalledAppItem[]> {
    const native = getNativePlugin();
    if (native) {
      try {
        const res = await native.getInstalledApps();
        return res.apps || [];
      } catch {}
    }
    return [];
  }

  private async syncTelemetryToBackend(telemetry: ScreenTimeTelemetry): Promise<void> {
    const payload = {
      category: "all_apps",
      duration_seconds: telemetry.totalScreenSeconds,
      started_at: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      ended_at: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      totalMinutes: telemetry.totalScreenMinutes,
      socialMinutes: telemetry.categories.social.minutes,
      productivityMinutes: telemetry.categories.productivity.minutes,
      entertainmentMinutes: telemetry.categories.entertainment.minutes,
      otherMinutes: telemetry.categories.other.minutes,
      unlockCount: telemetry.unlockCount,
    };

    const endpoints = [
      "http://10.0.2.2:8000/api/v1/screentime",
      "http://localhost:8000/api/v1/screentime",
      "http://10.0.2.2:5001/api/screentime",
      "http://localhost:5001/api/screentime",
    ];

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        break; // Successfully synced to active server
      } catch {}
    }
  }

  // ============================================================================
  // 7. FOCUS SESSIONS & TIMERS
  // ============================================================================

  private async restoreSessionIfActive() {
    try {
      const saved = await storage.getItem("lumen_live_focus_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isActive && !parsed.isPaused) {
          const now = Date.now();
          const elapsed = Math.floor((now - parsed.startedAtTimestamp) / 1000);
          if (elapsed < parsed.targetSeconds) {
            this.currentState = {
              ...parsed,
              elapsedSeconds: elapsed,
              remainingSeconds: parsed.targetSeconds - elapsed,
              progressPercent: Math.min(100, Math.round((elapsed / parsed.targetSeconds) * 100)),
            };
            this.startTicker();
            this.notifyFocus();
          } else {
            await this.completeSession(5, "Completed in background");
          }
        }
      }
    } catch {}
  }

  public async startFocusSession(
    type: FocusSessionType = "pomodoro",
    minutes = 25,
    blockedCategories: string[] = ["social", "video", "games"],
    enableDnd = true
  ): Promise<void> {
    this.stopTicker();
    this.triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    const targetSeconds = Math.max(60, minutes * 60);
    this.currentState = {
      isActive: true,
      isPaused: false,
      sessionType: type,
      targetSeconds,
      elapsedSeconds: 0,
      remainingSeconds: targetSeconds,
      progressPercent: 0,
      blockedCategories,
      currentQuote: getRandomMindfulQuote(),
      startedAtTimestamp: Date.now(),
    };

    await storage.setItem(
      "lumen_live_focus_session",
      JSON.stringify(this.currentState)
    );

    // Call native Android plugin for focus notification & DND
    const native = getNativePlugin();
    if (native) {
      try {
        await native.startFocusSession({
          sessionType: type,
          minutes,
          enableDnd,
        });
      } catch (err) {
        console.warn("Native startFocusSession err:", err);
      }
    }

    this.startTicker();
    this.notifyFocus();
  }

  public pauseFocusSession(): void {
    if (!this.currentState.isActive || this.currentState.isPaused) return;
    this.stopTicker();
    this.triggerHaptic();

    this.currentState = {
      ...this.currentState,
      isPaused: true,
    };
    this.persistLiveSession();
    this.notifyFocus();
  }

  public resumeFocusSession(): void {
    if (!this.currentState.isActive || !this.currentState.isPaused) return;
    this.triggerHaptic();

    this.currentState = {
      ...this.currentState,
      isPaused: false,
    };
    this.startTicker();
    this.persistLiveSession();
    this.notifyFocus();
  }

  public async completeSession(reflectionScore = 5, reflectionNote?: string): Promise<FocusSessionRecord> {
    this.stopTicker();
    this.triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    const nowIso = new Date().toISOString();
    const completedRecord: FocusSessionRecord = {
      id: `focus-${Date.now()}`,
      sessionType: this.currentState.sessionType,
      targetMinutes: Math.round(this.currentState.targetSeconds / 60),
      completedSeconds: this.currentState.elapsedSeconds || this.currentState.targetSeconds,
      status: "completed",
      distractingAppsBlocked: this.currentState.blockedCategories,
      reflectionScore,
      reflectionNote,
      startedAt: new Date(this.currentState.startedAtTimestamp || Date.now()).toISOString(),
      endedAt: nowIso,
    };

    await saveFocusSession(completedRecord);
    await storage.removeItem("lumen_live_focus_session");

    const native = getNativePlugin();
    if (native) {
      try {
        await native.stopFocusSession();
      } catch {}
    }

    this.currentState = {
      ...this.currentState,
      isActive: false,
      isPaused: false,
      progressPercent: 100,
      remainingSeconds: 0,
    };
    this.notifyFocus();

    return completedRecord;
  }

  public async cancelSession(): Promise<void> {
    this.stopTicker();
    this.triggerHaptic();

    if (this.currentState.isActive && this.currentState.elapsedSeconds > 60) {
      const record: FocusSessionRecord = {
        id: `focus-${Date.now()}`,
        sessionType: this.currentState.sessionType,
        targetMinutes: Math.round(this.currentState.targetSeconds / 60),
        completedSeconds: this.currentState.elapsedSeconds,
        status: "interrupted",
        distractingAppsBlocked: this.currentState.blockedCategories,
        startedAt: new Date(this.currentState.startedAtTimestamp || Date.now()).toISOString(),
        endedAt: new Date().toISOString(),
      };
      await saveFocusSession(record);
    }

    await storage.removeItem("lumen_live_focus_session");

    const native = getNativePlugin();
    if (native) {
      try {
        await native.stopFocusSession();
      } catch {}
    }

    this.currentState = {
      ...this.currentState,
      isActive: false,
      isPaused: false,
      elapsedSeconds: 0,
      remainingSeconds: this.currentState.targetSeconds,
      progressPercent: 0,
    };
    this.notifyFocus();
  }

  private startTicker() {
    this.stopTicker();
    this.timerRef = setInterval(async () => {
      if (!this.currentState.isActive || this.currentState.isPaused) return;

      const elapsed = this.currentState.elapsedSeconds + 1;
      const remaining = Math.max(0, this.currentState.targetSeconds - elapsed);
      const progress = Math.min(100, Math.round((elapsed / this.currentState.targetSeconds) * 100));

      let quote = this.currentState.currentQuote;
      if (elapsed > 0 && elapsed % 300 === 0) {
        quote = getRandomMindfulQuote();
      }

      this.currentState = {
        ...this.currentState,
        elapsedSeconds: elapsed,
        remainingSeconds: remaining,
        progressPercent: progress,
        currentQuote: quote,
      };

      if (remaining <= 0) {
        await this.completeSession(5, "Session finished successfully");
      } else {
        this.notifyFocus();
      }
    }, 1000);
  }

  private stopTicker() {
    if (this.timerRef) {
      clearInterval(this.timerRef);
      this.timerRef = null;
    }
  }

  private async persistLiveSession() {
    try {
      await storage.setItem(
        "lumen_live_focus_session",
        JSON.stringify(this.currentState)
      );
    } catch {}
  }

  // ============================================================================
  // 8. ANDROID DEEP LINK SETTINGS (Mindful PermissionsHelper)
  // ============================================================================

  public async openUsageAccessSettings(): Promise<boolean> {
    this.triggerHaptic();
    if (Platform.OS === "android") {
      try {
        await Linking.openURL("intent:#Intent;action=android.settings.USAGE_ACCESS_SETTINGS;data=package:com.meshmind.lumen;end");
        return true;
      } catch {
        try {
          await Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS");
          return true;
        } catch {
          await Linking.openSettings();
          return false;
        }
      }
    }
    await Linking.openSettings();
    return false;
  }

  public async openAccessibilitySettings(): Promise<boolean> {
    this.triggerHaptic();
    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.ACCESSIBILITY_SETTINGS");
        return true;
      } catch {
        try {
          await Linking.openURL("intent:#Intent;action=android.settings.ACCESSIBILITY_SETTINGS;end");
          return true;
        } catch {
          await Linking.openSettings();
          return false;
        }
      }
    }
    await Linking.openSettings();
    return false;
  }

  public async openOverlaySettings(): Promise<boolean> {
    this.triggerHaptic();
    if (Platform.OS === "android") {
      try {
        await Linking.openURL("package:com.meshmind.lumen");
        return true;
      } catch {
        try {
          await Linking.sendIntent("android.settings.action.MANAGE_OVERLAY_PERMISSION");
          return true;
        } catch {
          await Linking.openSettings();
          return false;
        }
      }
    }
    await Linking.openSettings();
    return false;
  }

  public async openDndSettings(): Promise<boolean> {
    this.triggerHaptic();
    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS");
        return true;
      } catch {
        try {
          await Linking.openURL("intent:#Intent;action=android.settings.NOTIFICATION_POLICY_ACCESS_SETTINGS;end");
          return true;
        } catch {
          await Linking.openSettings();
          return false;
        }
      }
    }
    await Linking.openSettings();
    return false;
  }

  public promptGuidedPermissionDialog(): void {
    if (Platform.OS === "android") {
      Alert.alert(
        "🛡️ Digital Wellbeing & Screen Access",
        "Lumen connects directly to Android's Usage Stats APIs to fetch real screen time, track app usage, and protect focus time.\n\nChoose permission to configure:",
        [
          {
            text: "1. Usage Access (Required for Screen Time)",
            onPress: () => this.requestUsagePermission(),
          },
          {
            text: "2. Do Not Disturb (DND for Focus Mode)",
            onPress: () => this.requestDndPermission(),
          },
          {
            text: "Open System App Settings",
            onPress: () => Linking.openSettings(),
          },
          { text: "Dismiss", style: "cancel" },
        ]
      );
    } else {
      Alert.alert(
        "Screen Time Access",
        "On iOS, screen time is managed natively via Apple Settings > Screen Time.",
        [
          { text: "Open Settings", onPress: () => Linking.openSettings() },
          { text: "Dismiss", style: "cancel" },
        ]
      );
    }
  }

  // ============================================================================
  // 9. TELEMETRY & DIGITAL BALANCE SCORING
  // ============================================================================

  public computeTelemetry(screenMinutes: number, limitMinutes = 240) {
    const hours = Math.floor(screenMinutes / 60);
    const mins = screenMinutes % 60;
    const limitHours = Math.floor(limitMinutes / 60);
    const limitMins = limitMinutes % 60;
    const ratio = limitMinutes > 0 ? screenMinutes / limitMinutes : 0;

    let balanceScore = 0.0;
    let statusLabel = "Standby • Ready";
    let statusBadgeColor = "#10b981";

    if (screenMinutes > 0) {
      if (ratio <= 0.6) {
        balanceScore = 9.8;
        statusLabel = "Optimal Flow";
        statusBadgeColor = "#10b981";
      } else if (ratio <= 0.85) {
        balanceScore = 8.8;
        statusLabel = "Balanced";
        statusBadgeColor = "#10b981";
      } else if (ratio <= 1.0) {
        balanceScore = 7.4;
        statusLabel = "Near Limit";
        statusBadgeColor = "#f59e0b";
      } else {
        balanceScore = Math.max(1.0, Number((6.5 - (ratio - 1.0) * 8).toFixed(1)));
        statusLabel = "Screen Heavy";
        statusBadgeColor = "#ef4444";
      }
    }

    return {
      hours,
      mins,
      limitHours,
      limitMins,
      ratio,
      percentUsed: Math.min(100, Math.round(ratio * 100)),
      balanceScore,
      statusLabel,
      statusBadgeColor,
    };
  }
}

export const digitalWellbeingService = new DigitalWellbeingService();
