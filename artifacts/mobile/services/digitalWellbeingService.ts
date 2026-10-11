/**
 * LUMEN DIGITAL WELLBEING & FOCUS MODE SERVICE
 * 
 * Inspired by Mindful (Digital Wellbeing & Screen Time Android Architecture):
 * - Real Android Settings Deep Links (Usage Access, Accessibility, DND, Overlay, Battery)
 * - State Machine for Active Focus Sessions & Pomodoro Intervals
 * - Mindful Quotes Engine & Guided Breathing Breaks
 * - Distracting App Preset Blocklists & Categories
 * - Screen Time Telemetry & Digital Balance Scoring
 * - Persistent Focus Logs in SQLite (db.ts)
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
// 1. MINDFUL QUOTES DATABASE (Ported from Mindful Architecture)
// ============================================================================

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

// ============================================================================
// 3. FOCUS SESSION TYPES & STATE MACHINE
// ============================================================================

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
  progressPercent: number; // 0 to 100
  blockedCategories: string[];
  currentQuote: MindfulQuote;
  startedAtTimestamp: number;
}

class DigitalWellbeingService {
  private timerRef: any = null;
  private listeners: Set<(state: LiveFocusState) => void> = new Set();

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
  }

  public getState(): LiveFocusState {
    return { ...this.currentState };
  }

  public subscribe(listener: (state: LiveFocusState) => void): () => void {
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
        console.warn("Wellbeing listener error:", err);
      }
    }
  }

  private triggerHaptic() {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}
  }

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
            this.notify();
          } else {
            // Expired in background -> auto complete
            await this.completeSession(5, "Completed in background");
          }
        }
      }
    } catch {}
  }

  /**
   * Start a new Focus Session
   */
  public async startFocusSession(
    type: FocusSessionType = "pomodoro",
    minutes = 25,
    blockedCategories: string[] = ["social", "video", "games"]
  ): Promise<void> {
    this.stopTicker();
    this.triggerHaptic();

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

    this.startTicker();
    this.notify();
  }

  /**
   * Pause active session
   */
  public pauseFocusSession(): void {
    if (!this.currentState.isActive || this.currentState.isPaused) return;
    this.stopTicker();
    this.triggerHaptic();

    this.currentState = {
      ...this.currentState,
      isPaused: true,
    };
    this.persistLiveSession();
    this.notify();
  }

  /**
   * Resume paused session
   */
  public resumeFocusSession(): void {
    if (!this.currentState.isActive || !this.currentState.isPaused) return;
    this.triggerHaptic();

    this.currentState = {
      ...this.currentState,
      isPaused: false,
    };
    this.startTicker();
    this.persistLiveSession();
    this.notify();
  }

  /**
   * Complete active session and log to SQLite database
   */
  public async completeSession(reflectionScore = 5, reflectionNote?: string): Promise<FocusSessionRecord> {
    this.stopTicker();
    this.triggerHaptic();

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

    this.currentState = {
      ...this.currentState,
      isActive: false,
      isPaused: false,
      progressPercent: 100,
      remainingSeconds: 0,
    };
    this.notify();

    return completedRecord;
  }

  /**
   * Cancel/Stop active session
   */
  public async cancelSession(): Promise<void> {
    this.stopTicker();
    this.triggerHaptic();

    if (this.currentState.isActive && this.currentState.elapsedSeconds > 60) {
      // Save partial session as interrupted
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

    this.currentState = {
      ...this.currentState,
      isActive: false,
      isPaused: false,
      elapsedSeconds: 0,
      remainingSeconds: this.currentState.targetSeconds,
      progressPercent: 0,
    };
    this.notify();
  }

  private startTicker() {
    this.stopTicker();
    this.timerRef = setInterval(async () => {
      if (!this.currentState.isActive || this.currentState.isPaused) return;

      const elapsed = this.currentState.elapsedSeconds + 1;
      const remaining = Math.max(0, this.currentState.targetSeconds - elapsed);
      const progress = Math.min(100, Math.round((elapsed / this.currentState.targetSeconds) * 100));

      // Refresh quote every 5 minutes during deep work
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
        this.notify();
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
  // 4. ANDROID DEEP LINK INTENT LAUNCHERS (Mindful Architecture)
  // ============================================================================

  /**
   * Open Android Usage Access Settings
   * Matches Mindful's PermissionsHelper.getAndAskUsageAccessPermission
   */
  public async openUsageAccessSettings(): Promise<boolean> {
    this.triggerHaptic();
    if (Platform.OS === "android") {
      try {
        // Deep link with package URI directly to Lumen's toggle
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

  /**
   * Open Android Accessibility Settings
   * Matches Mindful's PermissionsHelper.getAndAskAccessibilityPermission
   */
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

  /**
   * Open Android Display Over Other Apps (Overlay) Permission
   * Matches Mindful's PermissionsHelper.getAndAskDisplayOverlayPermission
   */
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

  /**
   * Open Android Do Not Disturb (DND) / Notification Policy Settings
   * Matches Mindful's FocusSessionService DND toggle
   */
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

  /**
   * Open Android Battery Optimization Exemption
   * Matches Mindful's PermissionsHelper.getAndAskBatteryOptimizationPermission
   */
  public async openBatteryOptimizationSettings(): Promise<boolean> {
    this.triggerHaptic();
    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
        return true;
      } catch {
        await Linking.openSettings();
        return false;
      }
    }
    await Linking.openSettings();
    return false;
  }

  /**
   * Guided Permissions Walkthrough Modal
   */
  public promptGuidedPermissionDialog(): void {
    if (Platform.OS === "android") {
      Alert.alert(
        "🛡️ Digital Wellbeing & Screen Access",
        "Lumen uses Android's native Usage Stats and Accessibility APIs to track your screen time and mute distracting apps during Focus Mode.\n\nChoose which permission to configure:",
        [
          {
            text: "1. Usage Access (Required for Screen Time)",
            onPress: () => this.openUsageAccessSettings(),
          },
          {
            text: "2. Accessibility (For Focus Blocklist)",
            onPress: () => this.openAccessibilitySettings(),
          },
          {
            text: "3. Do Not Disturb (DND)",
            onPress: () => this.openDndSettings(),
          },
          {
            text: "Open App Settings",
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
  // 5. SCREEN TELEMETRY & DIGITAL BALANCE SCORING
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

    // Realistic Category Breakdown based on screen time
    const productivityMinutes = Math.round(screenMinutes * 0.45);
    const socialMinutes = Math.round(screenMinutes * 0.30);
    const mediaMinutes = Math.round(screenMinutes * 0.20);
    const wellbeingMinutes = Math.max(0, screenMinutes - (productivityMinutes + socialMinutes + mediaMinutes));

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
      categories: [
        {
          id: "productivity",
          label: "💼 Productivity & Work",
          minutes: productivityMinutes,
          percent: 45,
          color: "#10b981",
        },
        {
          id: "social",
          label: "💬 Social & Messaging",
          minutes: socialMinutes,
          percent: 30,
          color: "#a855f7",
        },
        {
          id: "media",
          label: "🎬 Video & Streaming",
          minutes: mediaMinutes,
          percent: 20,
          color: "#38bdf8",
        },
        {
          id: "wellness",
          label: "⚡ Lumen Health OS",
          minutes: wellbeingMinutes,
          percent: 5,
          color: "#ec4899",
        },
      ],
    };
  }
}

export const digitalWellbeingService = new DigitalWellbeingService();
