/**
 * LUMEN AUTOMATED DAILY MIDNIGHT ROLLOVER SERVICE
 * 
 * Clinical & Telemetry Lifecycle Engine:
 * - Automatically detects local midnight transition (00:00:00) via high-precision timer & AppState resumption.
 * - Snapshots yesterday's completed daily health metrics (steps, active calories, nutrition macros,
 *   hydration, sleep score, and overall readiness) into SQLite/kv_store for Analytics & Streak preservation.
 * - Resets active telemetry (steps baseline, today's calories consumed, today's meals timeline,
 *   hydration cups, active session sleep prompt) cleanly to 0 for a fresh, inspiring new day.
 * - Triggers an elegant "🌅 New Day, Clean Slate" celebratory banner upon first opening after midnight.
 * - Notifies all UI listeners (Dashboard, Nutrition, Activity) to re-render in 0ms seamlessly.
 */

import { AppState, AppStateStatus, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { storage } from "./storage";
import { formatDateKey, setKV } from "./db";
import { computeAndSaveDailySnapshot } from "./dailyHealthMetrics";
import { fitnessWatchSensor } from "./fitnessWatchSensor";
import { nativeStepCounter } from "./nativeStepCounter";
import { hydrationService } from "./hydrationService";

const STORAGE_KEY_LAST_ACTIVE_DATE = "lumen_last_active_date";
const STORAGE_KEY_FRESH_DAY_TOAST = "lumen_fresh_day_toast_pending";

type RolloverListener = (newDateKey: string) => void;

class DailyRolloverService {
  private isInitialized = false;
  private isRollingOver = false;
  private midnightTimer: any = null;
  private appStateSubscription: any = null;
  private listeners: Set<RolloverListener> = new Set();

  /**
   * Initialize the midnight watcher lifecycle:
   * 1. Check if today is already a new day compared to last active date.
   * 2. Arm precise local midnight timer.
   * 3. Attach AppState listener to handle device wakeup / screen unlock.
   */
  public async initDailyRolloverWatcher(onRollover?: RolloverListener): Promise<void> {
    if (onRollover) {
      this.listeners.add(onRollover);
    }

    if (this.isInitialized) {
      // If already initialized, just run an immediate check
      await this.checkAndPerformDailyRollover();
      return;
    }

    this.isInitialized = true;

    // 1. Initial startup check
    await this.checkAndPerformDailyRollover();

    // 2. Schedule next midnight timer
    this.scheduleNextMidnightTimer();

    // 3. AppState change listener (resuming from background/sleep)
    this.appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        this.checkAndPerformDailyRollover();
      }
    });
  }

  /**
   * Subscribe to daily rollover events.
   */
  public subscribe(listener: RolloverListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(newDateKey: string) {
    this.listeners.forEach((listener) => {
      try {
        listener(newDateKey);
      } catch (err) {
        console.warn("[DailyRollover] Listener error:", err);
      }
    });
  }

  /**
   * Calculate exact milliseconds until the next 00:00:02 local time and set timer.
   */
  private scheduleNextMidnightTimer() {
    if (this.midnightTimer) {
      clearTimeout(this.midnightTimer);
      this.midnightTimer = null;
    }

    const now = new Date();
    // Midnight + 2 seconds buffer to ensure local calendar day has rolled over
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      2
    );

    const delayMs = Math.max(2000, nextMidnight.getTime() - now.getTime());

    this.midnightTimer = setTimeout(async () => {
      await this.checkAndPerformDailyRollover(true);
      // Re-schedule for following midnight
      this.scheduleNextMidnightTimer();
    }, delayMs);
  }

  /**
   * Core verification & rollover routine.
   * If the current date key differs from stored lumen_last_active_date,
   * it executes the archiving & active reset workflow.
   */
  public async checkAndPerformDailyRollover(force = false): Promise<boolean> {
    if (this.isRollingOver) return false;

    try {
      const todayKey = formatDateKey(new Date());
      const lastActiveDate = await storage.getItem(STORAGE_KEY_LAST_ACTIVE_DATE);

      // First ever app launch on this device
      if (!lastActiveDate) {
        await storage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayKey);
        return false;
      }

      // Same calendar day, no rollover needed
      if (!force && lastActiveDate === todayKey) {
        return false;
      }

      this.isRollingOver = true;
      console.log(`[DailyRollover] Midnight transition detected: archiving ${lastActiveDate} -> starting ${todayKey}`);

      // 1. Snapshot and archive yesterday's full telemetry for Analytics & Streaks
      try {
        // Ensure yesterday's steps recorded in native background are written to KV store
        const yesterdayNative = await nativeStepCounter.getStepsForDate(lastActiveDate);
        if (yesterdayNative && yesterdayNative.steps > 0) {
          await setKV(`lumen_daily_steps_${lastActiveDate}`, String(yesterdayNative.steps)).catch(() => {});
          await setKV(`lumen_daily_cals_${lastActiveDate}`, String(yesterdayNative.caloriesBurned)).catch(() => {});
          await setKV(`lumen_daily_dist_${lastActiveDate}`, String(yesterdayNative.distanceKm)).catch(() => {});
        }
        await computeAndSaveDailySnapshot(lastActiveDate);
        console.log(`[DailyRollover] Archived health snapshot for ${lastActiveDate}`);
      } catch (snapshotErr) {
        console.warn(`[DailyRollover] Snapshot archive warning for ${lastActiveDate}:`, snapshotErr);
      }

      // 2. Handle Today's Steps (CRITICAL: Do NOT wipe out steps already walked after midnight!)
      try {
        const todayNative = await nativeStepCounter.refreshTodaySteps();
        const todaySteps = todayNative?.steps || 0;

        if (todaySteps > 0) {
          // User already walked after midnight! Preserve and sync into live sensor engine
          fitnessWatchSensor.syncNativeBackgroundSteps(
            todaySteps,
            todayNative?.caloriesBurned,
            todayNative?.distanceKm
          );
          console.log(`[DailyRollover] Preserved ${todaySteps} steps walked after midnight for today (${todayKey})`);
        } else {
          // Zero steps for today: cleanly initialize today's baseline
          fitnessWatchSensor.resetDailyCounters(todayKey);
          if (force) {
            await nativeStepCounter.resetDailySteps();
          }
        }
      } catch (stepErr) {
        console.warn("[DailyRollover] Step handling warning:", stepErr);
      }

      // 3. Reset Hydration state
      try {
        await hydrationService.refreshState(0, 0);
      } catch (hydErr) {
        console.warn("[DailyRollover] Hydration refresh warning:", hydErr);
      }

      // 4. Clear yesterday's temporary sleep session prompt cache
      try {
        await storage.removeItem("lumen_sleep_session");
      } catch {}

      // 5. Set fresh day toast flag so user receives the morning celebration banner
      await storage.setItem(STORAGE_KEY_FRESH_DAY_TOAST, todayKey);

      // 6. Update last active date to today
      await storage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, todayKey);

      // 7. Optional Haptic feedback on supported devices
      if (Platform.OS !== "web") {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }

      // 8. Notify all UI subscribers to refresh their views to 0
      this.notify(todayKey);
      return true;
    } catch (err) {
      console.error("[DailyRollover] Error during rollover:", err);
      return false;
    } finally {
      this.isRollingOver = false;
    }
  }

  /**
   * Consume fresh day toast flag. Returns true if toast should be shown for today.
   */
  public async consumeFreshDayToast(): Promise<boolean> {
    try {
      const pendingDate = await storage.getItem(STORAGE_KEY_FRESH_DAY_TOAST);
      const todayKey = formatDateKey(new Date());

      if (pendingDate === todayKey) {
        // Clear flag so it is only displayed once per day
        await storage.removeItem(STORAGE_KEY_FRESH_DAY_TOAST);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Debug / Demo helper: Simulates midnight rollover immediately.
   */
  public async simulateMidnightRollover(): Promise<boolean> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = formatDateKey(yesterday);
    await storage.setItem(STORAGE_KEY_LAST_ACTIVE_DATE, yesterdayKey);
    return await this.checkAndPerformDailyRollover(true);
  }
}

export const dailyRolloverService = new DailyRolloverService();
