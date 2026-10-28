import { sendLocalNotification, getNotificationPreferences } from "./notifications";
import { getKV, setKV } from "./db";

// ============================================================================
// PROACTIVE REAL-TIME BIOMARKER SURVEILLANCE ENGINE
// Evaluates live metrics (hydration, screen time, steps) against user targets
// and fires intelligent, non-intrusive heads-up notifications.
// ============================================================================

const LAST_ALERT_PREFIX = "last_alert_ts_";

/**
 * Checks if enough cooldown time (e.g. 90 minutes) has passed since the last alert of this type.
 */
async function canSendAlert(alertKey: string, cooldownMinutes = 90): Promise<boolean> {
  try {
    const raw = await getKV(LAST_ALERT_PREFIX + alertKey);
    if (!raw) return true;
    const lastTs = parseInt(raw, 10);
    const elapsedMinutes = (Date.now() - lastTs) / (1000 * 60);
    return elapsedMinutes >= cooldownMinutes;
  } catch {
    return true;
  }
}

async function markAlertSent(alertKey: string): Promise<void> {
  try {
    await setKV(LAST_ALERT_PREFIX + alertKey, Date.now().toString());
  } catch {
    // ignore
  }
}

export const proactiveAlertEngine = {
  /**
   * Evaluates screen time against daily budget.
   * If usage exceeds 80% or 100%, dispatches a mindful warning.
   */
  async evaluateScreenTime(usedMinutes: number, limitMinutes: number) {
    if (limitMinutes <= 0 || usedMinutes <= 0) return;
    const prefs = await getNotificationPreferences();
    if (!prefs.masterEnabled || !prefs.screenTimeAlertsEnabled) return;

    const ratio = usedMinutes / limitMinutes;

    if (ratio >= 1.0) {
      if (await canSendAlert("screentime_100", 60)) {
        await sendLocalNotification({
          id: 9101,
          title: "🛑 Screen Time Budget Exceeded",
          body: `You've reached ${Math.round(usedMinutes)}m of your ${limitMinutes}m daily mindful budget. Consider activating Wind-Down mode.`,
          channelId: "lumen_screentime",
        });
        await markAlertSent("screentime_100");
      }
    } else if (ratio >= 0.8) {
      if (await canSendAlert("screentime_80", 90)) {
        await sendLocalNotification({
          id: 9102,
          title: "⚠️ Approaching Screen Limit (80%)",
          body: `You have ${Math.max(0, limitMinutes - usedMinutes)} minutes remaining of your daily mindful digital allowance.`,
          channelId: "lumen_screentime",
        });
        await markAlertSent("screentime_80");
      }
    }
  },

  /**
   * Evaluates daytime hydration pacing.
   * If it's afternoon and user has logged < 50% of target, dispatches an alert.
   */
  async evaluateHydration(currentCups: number, targetCups = 10) {
    const prefs = await getNotificationPreferences();
    if (!prefs.masterEnabled || !prefs.hydrationEnabled) return;

    const hour = new Date().getHours();
    // Only check between 13:00 and 20:00
    if (hour >= 13 && hour <= 20) {
      const halfTarget = targetCups / 2;
      if (currentCups < halfTarget) {
        if (await canSendAlert("hydration_deficit", 120)) {
          await sendLocalNotification({
            id: 9103,
            title: "💧 Cellular Hydration Lag",
            body: `You've logged ${currentCups} of ${targetCups} cups today. Drink 2 glasses of water to maintain cellular fluid balance.`,
            channelId: "lumen_hydration",
          });
          await markAlertSent("hydration_deficit");
        }
      }
    }
  },

  /**
   * Evaluates daily movement pacing.
   */
  async evaluateMovement(currentSteps: number, targetSteps = 10000) {
    const prefs = await getNotificationPreferences();
    if (!prefs.masterEnabled || !prefs.movementAlertsEnabled) return;

    const hour = new Date().getHours();
    // Check in late afternoon (around 16:00 - 18:00) if user is significantly behind
    if (hour >= 16 && hour <= 18) {
      if (currentSteps < targetSteps * 0.4) {
        if (await canSendAlert("movement_deficit", 180)) {
          await sendLocalNotification({
            id: 9104,
            title: "🏃 Daily Step Deficit",
            body: `You're currently at ${currentSteps.toLocaleString()} steps. An evening stroll can help you hit your ${targetSteps.toLocaleString()} step goal!`,
            channelId: "lumen_movement",
          });
          await markAlertSent("movement_deficit");
        }
      }
    }
  },

  /**
   * Manual dispatch of an immediate proactive alert.
   */
  async dispatchCustomAlert(title: string, body: string, channelId = "lumen_alerts" as const) {
    return sendLocalNotification({
      title,
      body,
      channelId,
    });
  },
};
