import { AppState, AppStateStatus } from "react-native";
import { fitnessWatchSensor } from "./fitnessWatchSensor";

export interface NativeStepData {
  steps: number;
  distanceKm: number;
  caloriesBurned: number;
  cadenceSpm?: number;
  isTracking?: boolean;
  hasHardwareSensor?: boolean;
  date?: string;
  granted?: boolean;
}

const getCapacitor = () => {
  if (typeof window !== "undefined" && (window as any).Capacitor) {
    return (window as any).Capacitor;
  }
  return null;
};

const getNativePlugin = () => {
  const cap = getCapacitor();
  if (!cap) return null;
  if (cap.Plugins && cap.Plugins.StepCounter) {
    return cap.Plugins.StepCounter;
  }
  if (typeof cap.registerPlugin === "function") {
    try {
      return cap.registerPlugin("StepCounter");
    } catch {
      // plugin registration fallback
    }
  }
  return null;
};

class NativeStepCounterService {
  private isInitialized = false;
  private stepListenerHandle: any = null;
  private appStateSubscription: any = null;
  private lastSyncedSteps = 0;

  public isAvailable(): boolean {
    const cap = getCapacitor();
    if (!cap) return false;
    // Check if running inside Capacitor on a native platform or if plugin is registered
    if (typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
      return true;
    }
    if (typeof cap.getPlatform === "function" && cap.getPlatform() !== "web") {
      return true;
    }
    return Boolean(getNativePlugin());
  }

  public async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (!this.isAvailable()) {
      return;
    }

    const plugin = getNativePlugin();
    if (!plugin) return;

    try {
      // 1. Check native step counter / activity recognition permissions
      let hasPermission = false;
      if (typeof plugin.checkStepPermissions === "function") {
        const perm = await plugin.checkStepPermissions();
        hasPermission = Boolean(perm?.granted);
      } else if (typeof plugin.checkPermissions === "function") {
        const perm = await plugin.checkPermissions();
        hasPermission = Boolean(perm?.activityRecognition === "granted");
      }

      // 2. Start 24/7 background tracking service (passing existing steps as baseline)
      const currentInitialSteps = fitnessWatchSensor.getDailySteps();
      if (typeof plugin.startBackgroundTracking === "function") {
        const startRes = await plugin.startBackgroundTracking({
          initialSteps: currentInitialSteps > 0 ? currentInitialSteps : undefined,
        });
        if (startRes && typeof startRes.steps === "number") {
          this.syncStepsToEngine(startRes);
        }
      }

      // 3. Query current today's steps already accumulated while app was closed
      if (typeof plugin.getTodaySteps === "function") {
        const todayData = await plugin.getTodaySteps();
        if (todayData && typeof todayData.steps === "number") {
          this.syncStepsToEngine(todayData);
        }
      }

      // 4. Listen to continuous step updates from the native Android service
      if (typeof plugin.addListener === "function") {
        this.stepListenerHandle = await plugin.addListener("stepUpdate", (data: NativeStepData) => {
          this.syncStepsToEngine(data);
        });
      }

      // 5. When app comes back to the foreground (resumes), fetch all background steps
      this.appStateSubscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
        if (nextState === "active") {
          this.refreshTodaySteps();
        }
      });
    } catch (err) {
      console.warn("Native StepCounter initialization skipped/failed:", err);
    }
  }

  public async checkPermissions(): Promise<{ granted: boolean; hasHardwareSensor?: boolean }> {
    const plugin = getNativePlugin();
    if (!plugin) return { granted: false, hasHardwareSensor: false };

    try {
      if (typeof plugin.checkStepPermissions === "function") {
        const res = await plugin.checkStepPermissions();
        return {
          granted: Boolean(res?.granted),
          hasHardwareSensor: Boolean(res?.hasHardwareSensor),
        };
      }
      if (typeof plugin.checkPermissions === "function") {
        const res = await plugin.checkPermissions();
        return {
          granted: res?.activityRecognition === "granted",
          hasHardwareSensor: true,
        };
      }
    } catch (e) {
      console.warn("checkPermissions error:", e);
    }
    return { granted: false, hasHardwareSensor: false };
  }

  public async requestPermissions(): Promise<{ granted: boolean }> {
    const plugin = getNativePlugin();
    if (!plugin) return { granted: false };

    try {
      if (typeof plugin.requestStepPermissions === "function") {
        const res = await plugin.requestStepPermissions();
        const granted = Boolean(res?.granted);
        if (granted) {
          // Restart background tracking with baseline
          await this.startBackgroundTracking(fitnessWatchSensor.getDailySteps());
          await this.refreshTodaySteps();
        }
        return { granted };
      }
      if (typeof plugin.requestPermissions === "function") {
        const res = await plugin.requestPermissions({ permissions: ["activityRecognition", "notifications"] });
        const granted = res?.activityRecognition === "granted";
        if (granted) {
          await this.startBackgroundTracking(fitnessWatchSensor.getDailySteps());
          await this.refreshTodaySteps();
        }
        return { granted };
      }
    } catch (e) {
      console.warn("requestPermissions error:", e);
    }
    return { granted: false };
  }

  public async isBatteryOptimizationIgnored(): Promise<boolean> {
    const plugin = getNativePlugin();
    if (!plugin || typeof plugin.isBatteryOptimizationIgnored !== "function") return true;
    try {
      const res = await plugin.isBatteryOptimizationIgnored();
      return Boolean(res?.isIgnoring);
    } catch {
      return true;
    }
  }

  public async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    const plugin = getNativePlugin();
    if (!plugin || typeof plugin.requestIgnoreBatteryOptimizations !== "function") return true;
    try {
      const res = await plugin.requestIgnoreBatteryOptimizations();
      return Boolean(res?.isIgnoringBatteryOptimizations);
    } catch {
      return false;
    }
  }

  public async refreshTodaySteps(): Promise<NativeStepData | null> {
    const plugin = getNativePlugin();
    if (!plugin || typeof plugin.getTodaySteps !== "function") return null;

    try {
      const data = await plugin.getTodaySteps();
      if (data && typeof data.steps === "number") {
        this.syncStepsToEngine(data);
        return data;
      }
    } catch (e) {
      console.warn("Could not refresh today steps from native service:", e);
    }
    return null;
  }

  public async startBackgroundTracking(initialSteps?: number): Promise<boolean> {
    const plugin = getNativePlugin();
    if (!plugin || typeof plugin.startBackgroundTracking !== "function") return false;
    try {
      const baseline = typeof initialSteps === "number" && initialSteps > 0
        ? initialSteps
        : fitnessWatchSensor.getDailySteps();

      const res = await plugin.startBackgroundTracking({ initialSteps: baseline });
      if (res && typeof res.steps === "number") {
        this.syncStepsToEngine(res);
      }
      return Boolean(res?.success || res?.isTracking);
    } catch {
      return false;
    }
  }

  public async stopBackgroundTracking(): Promise<boolean> {
    const plugin = getNativePlugin();
    if (!plugin || typeof plugin.stopBackgroundTracking !== "function") return false;
    try {
      const res = await plugin.stopBackgroundTracking();
      return Boolean(res?.success);
    } catch {
      return false;
    }
  }

  private syncStepsToEngine(data: NativeStepData) {
    if (typeof data.steps === "number" && data.steps >= 0) {
      this.lastSyncedSteps = data.steps;
      fitnessWatchSensor.syncNativeBackgroundSteps(
        data.steps,
        data.caloriesBurned || Math.round(data.steps * 0.043),
        data.distanceKm || parseFloat((data.steps * 0.00075).toFixed(2))
      );
    }
  }
}

export const nativeStepCounter = new NativeStepCounterService();
