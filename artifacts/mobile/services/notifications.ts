import { Platform } from "react-native";
import { getKV, setKV } from "./db";

// ============================================================================
// LUMEN PROACTIVE NOTIFICATION & HEALTH ALERT ENGINE
// Native Android AlarmManager & NotificationCompat + Universal Web Fallback
// ============================================================================

export type NotificationChannelId =
  | "lumen_alerts"
  | "lumen_hydration"
  | "lumen_movement"
  | "lumen_briefing"
  | "lumen_screentime"
  | "lumen_nutrition";

export interface NotificationOptions {
  id?: number;
  title: string;
  body: string;
  channelId?: NotificationChannelId;
}

export interface NotificationScheduleOptions {
  id: number;
  title: string;
  body: string;
  channelId?: NotificationChannelId;
  triggerAtMillis: number;
  intervalMillis?: number;
}

export interface NotificationPreferences {
  masterEnabled: boolean;
  hydrationEnabled: boolean;
  hydrationIntervalHours: number; // 2, 3, or 4
  movementAlertsEnabled: boolean;
  morningBriefingEnabled: boolean;
  morningBriefingTime: string; // "08:00"
  eveningWindDownEnabled: boolean;
  eveningWindDownTime: string; // "22:00"
  mealPromptsEnabled: boolean;
  lunchPromptTime: string; // "13:00"
  dinnerPromptTime: string; // "19:30"
  screenTimeAlertsEnabled: boolean;
  screenTimeWarningPercent: number; // 80 or 100
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  masterEnabled: true,
  hydrationEnabled: true,
  hydrationIntervalHours: 2,
  movementAlertsEnabled: true,
  morningBriefingEnabled: true,
  morningBriefingTime: "08:00",
  eveningWindDownEnabled: true,
  eveningWindDownTime: "22:00",
  mealPromptsEnabled: true,
  lunchPromptTime: "13:00",
  dinnerPromptTime: "19:30",
  screenTimeAlertsEnabled: true,
  screenTimeWarningPercent: 80,
};

const PREFS_KEY = "lumen_notification_preferences_v1";

// Helper to access Capacitor Native Plugin
const getCapacitor = () => {
  if (typeof window !== "undefined" && (window as any).Capacitor) {
    return (window as any).Capacitor;
  }
  return null;
};

const getNativeNotificationPlugin = () => {
  const cap = getCapacitor();
  if (!cap) return null;
  if (cap.Plugins && cap.Plugins.LumenNotification) {
    return cap.Plugins.LumenNotification;
  }
  if (typeof cap.registerPlugin === "function") {
    try {
      return cap.registerPlugin("LumenNotification");
    } catch {
      // ignore
    }
  }
  return null;
};

/**
 * Checks whether notifications are granted at OS / browser level.
 */
export async function checkNotificationPermissions(): Promise<{
  granted: boolean;
  areNotificationsEnabled: boolean;
}> {
  const plugin = getNativeNotificationPlugin();
  if (plugin && typeof plugin.checkPermissions === "function") {
    try {
      const res = await plugin.checkPermissions();
      return {
        granted: Boolean(res?.granted),
        areNotificationsEnabled: Boolean(res?.areNotificationsEnabled),
      };
    } catch (e) {
      console.warn("LumenNotification.checkPermissions error:", e);
    }
  }

  // Web fallback
  if (typeof window !== "undefined" && "Notification" in window) {
    const granted = Notification.permission === "granted";
    return {
      granted,
      areNotificationsEnabled: granted,
    };
  }

  return { granted: true, areNotificationsEnabled: true };
}

/**
 * Requests notification permissions from the OS.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const plugin = getNativeNotificationPlugin();
  if (plugin && typeof plugin.requestPermissions === "function") {
    try {
      const res = await plugin.requestPermissions();
      return Boolean(res?.granted);
    } catch (e) {
      console.warn("LumenNotification.requestPermissions error:", e);
    }
  }

  // Web fallback
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Opens system notification settings for this application.
 */
export async function openSystemNotificationSettings(): Promise<void> {
  const plugin = getNativeNotificationPlugin();
  if (plugin && typeof plugin.openNotificationSettings === "function") {
    try {
      await plugin.openNotificationSettings();
      return;
    } catch (e) {
      console.warn("Failed opening notification settings via plugin:", e);
    }
  }
}

/**
 * Immediately dispatches an active heads-up notification.
 */
export async function sendLocalNotification(
  options: NotificationOptions
): Promise<number | null> {
  const plugin = getNativeNotificationPlugin();
  const id = options.id || Math.floor(Date.now() % 100000);

  if (plugin && typeof plugin.postNotification === "function") {
    try {
      await plugin.postNotification({
        id,
        title: options.title,
        body: options.body,
        channelId: options.channelId || "lumen_alerts",
      });
      return id;
    } catch (e) {
      console.warn("Failed posting native notification:", e);
    }
  }

  // Web fallback
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission === "granted") {
        new Notification(options.title, {
          body: options.body,
          icon: "/favicon.ico",
        });
        return id;
      }
    } catch (e) {
      console.warn("Web notification error:", e);
    }
  }

  return null;
}

/**
 * Schedules a persistent notification via Android AlarmManager or timeout.
 */
export async function scheduleLocalNotification(
  options: NotificationScheduleOptions
): Promise<boolean> {
  const plugin = getNativeNotificationPlugin();

  if (plugin && typeof plugin.scheduleNotification === "function") {
    try {
      await plugin.scheduleNotification({
        id: options.id,
        title: options.title,
        body: options.body,
        channelId: options.channelId || "lumen_alerts",
        triggerAtMillis: options.triggerAtMillis,
        intervalMillis: options.intervalMillis || 0,
      });
      return true;
    } catch (e) {
      console.warn("Failed scheduling native notification:", e);
    }
  }

  // Web fallback with setTimeout if in near future (< 24h)
  const delay = options.triggerAtMillis - Date.now();
  if (delay > 0 && delay < 86400000 && typeof window !== "undefined") {
    setTimeout(() => {
      sendLocalNotification({
        id: options.id,
        title: options.title,
        body: options.body,
        channelId: options.channelId,
      });
    }, delay);
    return true;
  }

  return false;
}

/**
 * Cancels a specific scheduled notification.
 */
export async function cancelLocalNotification(id: number): Promise<void> {
  const plugin = getNativeNotificationPlugin();
  if (plugin && typeof plugin.cancelNotification === "function") {
    try {
      await plugin.cancelNotification({ id });
    } catch (e) {
      console.warn("Failed cancelling native notification:", e);
    }
  }
}

/**
 * Cancels all scheduled notifications.
 */
export async function cancelAllLocalNotifications(): Promise<void> {
  const plugin = getNativeNotificationPlugin();
  if (plugin && typeof plugin.cancelAllNotifications === "function") {
    try {
      await plugin.cancelAllNotifications();
    } catch (e) {
      console.warn("Failed cancelling all native notifications:", e);
    }
  }
}

/**
 * Dispatches an instant test notification for user verification.
 */
export async function sendTestNotification(
  channelId: NotificationChannelId = "lumen_alerts"
): Promise<boolean> {
  const hasPerm = await requestNotificationPermissions();
  if (!hasPerm) {
    return false;
  }

  const id = Math.floor(Date.now() % 100000);
  const titles: Record<NotificationChannelId, { title: string; body: string }> = {
    lumen_alerts: {
      title: "⚡ Lumen Bio-Intelligence Alert",
      body: "Proactive alert engine operational. Real-time biomarker anomaly monitoring is active.",
    },
    lumen_hydration: {
      title: "💧 Cellular Hydration Prompt",
      body: "Hydration target check: Drink 250ml of water now to maintain optimal blood volume.",
    },
    lumen_movement: {
      title: "🏃 Movement & Sedentary Alert",
      body: "Inactivity detected. Stand up and take a brisk 5-minute walk to stimulate circulation.",
    },
    lumen_briefing: {
      title: "🌅 Morning Bio-Readiness Briefing",
      body: "Good morning! Readiness Score is 92%. Metabolic target: 10,000 steps & 2,600 kcal.",
    },
    lumen_screentime: {
      title: "📱 Mindful Screen Time Alert",
      body: "Daily screen budget warning: You have reached 80% of your mindful digital quota.",
    },
    lumen_nutrition: {
      title: "🥗 Nutrition & Macro Check-in",
      body: "Midday nutrition prompt: Log your lunch to keep your daily protein curve on target.",
    },
  };

  const alertData = titles[channelId] || titles.lumen_alerts;
  const res = await sendLocalNotification({
    id,
    title: alertData.title,
    body: alertData.body,
    channelId,
  });

  return res !== null;
}

/**
 * Loads user notification preferences from persistent storage.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await getKV(PREFS_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("Error loading notification preferences:", e);
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

/**
 * Saves notification preferences and re-synchronizes scheduled Android alarms.
 */
export async function saveNotificationPreferences(
  prefs: NotificationPreferences
): Promise<void> {
  try {
    await setKV(PREFS_KEY, JSON.stringify(prefs));
    await syncNotificationSchedules(prefs);
  } catch (e) {
    console.warn("Error saving notification preferences:", e);
  }
}

/**
 * Helper to compute the next timestamp for a given time string "HH:mm".
 */
function getNextOccurrenceMillis(timeStr: string): number {
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10) || 8;
  const minutes = parseInt(parts[1], 10) || 0;

  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

/**
 * Synchronizes and schedules all proactive Android alarms according to user preferences.
 */
export async function syncNotificationSchedules(
  customPrefs?: NotificationPreferences
): Promise<void> {
  const prefs = customPrefs || (await getNotificationPreferences());

  // If master is disabled, wipe all scheduled alarms
  if (!prefs.masterEnabled) {
    await cancelAllLocalNotifications();
    return;
  }

  // Request permissions if not granted
  await requestNotificationPermissions();

  const DAY_MILLIS = 24 * 60 * 60 * 1000;

  // 1. Morning Bio-Briefing (ID: 8001)
  if (prefs.morningBriefingEnabled) {
    const trigger = getNextOccurrenceMillis(prefs.morningBriefingTime);
    await scheduleLocalNotification({
      id: 8001,
      title: "🌅 Morning Bio-Readiness Briefing",
      body: "Your daily biomarkers are synced. Review your activity goals, sleep score, and hydration plan.",
      channelId: "lumen_briefing",
      triggerAtMillis: trigger,
      intervalMillis: DAY_MILLIS,
    });
  } else {
    await cancelLocalNotification(8001);
  }

  // 2. Evening Sleep Wind-Down (ID: 8002)
  if (prefs.eveningWindDownEnabled) {
    const trigger = getNextOccurrenceMillis(prefs.eveningWindDownTime);
    await scheduleLocalNotification({
      id: 8002,
      title: "🌙 Nightly Sleep Wind-Down",
      body: "Time to disconnect from blue light screens and activate your circadian recovery protocol.",
      channelId: "lumen_briefing",
      triggerAtMillis: trigger,
      intervalMillis: DAY_MILLIS,
    });
  } else {
    await cancelLocalNotification(8002);
  }

  // 3. Lunch Prompt (ID: 8003)
  if (prefs.mealPromptsEnabled) {
    const trigger = getNextOccurrenceMillis(prefs.lunchPromptTime);
    await scheduleLocalNotification({
      id: 8003,
      title: "🥗 Midday Meal Logging",
      body: "Log your lunch to track your protein distribution and glycemic load.",
      channelId: "lumen_nutrition",
      triggerAtMillis: trigger,
      intervalMillis: DAY_MILLIS,
    });
  } else {
    await cancelLocalNotification(8003);
  }

  // 4. Dinner Prompt (ID: 8004)
  if (prefs.mealPromptsEnabled) {
    const trigger = getNextOccurrenceMillis(prefs.dinnerPromptTime);
    await scheduleLocalNotification({
      id: 8004,
      title: "🍽️ Evening Nutrition Review",
      body: "Record dinner before your digestive rest window to finalize today's metabolic log.",
      channelId: "lumen_nutrition",
      triggerAtMillis: trigger,
      intervalMillis: DAY_MILLIS,
    });
  } else {
    await cancelLocalNotification(8004);
  }

  // 5. Periodic Hydration Reminder (ID: 8005)
  if (prefs.hydrationEnabled) {
    const intervalHours = Math.max(1, prefs.hydrationIntervalHours || 2);
    const intervalMillis = intervalHours * 60 * 60 * 1000;
    // Schedule first prompt 2 hours from now
    const firstTrigger = Date.now() + intervalMillis;

    await scheduleLocalNotification({
      id: 8005,
      title: "💧 Cellular Hydration Reminder",
      body: "Take a hydration break. Sip 250ml of clean water to maintain fluid cellular homeostasis.",
      channelId: "lumen_hydration",
      triggerAtMillis: firstTrigger,
      intervalMillis: intervalMillis,
    });
  } else {
    await cancelLocalNotification(8005);
  }

  // 6. Movement / Sedentary Reminder (ID: 8006)
  if (prefs.movementAlertsEnabled) {
    const intervalMillis = 2 * 60 * 60 * 1000; // Every 2 hours
    const firstTrigger = Date.now() + intervalMillis;

    await scheduleLocalNotification({
      id: 8006,
      title: "🏃 Movement Prompt",
      body: "Sedentary alert: Step away from your desk and hit a 500-step walk to stimulate metabolic rate.",
      channelId: "lumen_movement",
      triggerAtMillis: firstTrigger,
      intervalMillis: intervalMillis,
    });
  } else {
    await cancelLocalNotification(8006);
  }
}
