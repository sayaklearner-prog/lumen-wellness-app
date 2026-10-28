import { AppState, AppStateStatus, Platform } from "react-native";
import { fitnessWatchSensor } from "./fitnessWatchSensor";

export interface NativeStepData {
  steps: number;
  distanceKm: number;
  caloriesBurned: number;
  cadenceSpm?: number;
  isTracking?: boolean;
  hasHardwareSensor?: boolean;
  date?: string;
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
  if (cap.isPluginAvailable && cap.isPluginAvailable("StepCounter")) {
    return cap.Plugins?.StepCounter || cap.registerPlugin("StepCounter");
  }
  if (cap.Plugins && cap.Plugins.StepCounter) {
    return cap.Plugins.StepCounter;
  }
  return null;
};

class NativeStepCounterService {
  private isInitialized = false;
  private stepListenerHandle: any = null;
  private appStateSubscription: any = null;

  public isAvailable(): boolean {
    if (Platform.OS === "web") return false;
    const plugin = getNativePlugin();
    return Boolean(plugin);
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
      // 1. Check and request native activity recognition permission
      if (typeof plugin.checkStepPermissions === "function") {
        const perm = await plugin.checkStepPermissions();
        if (!perm.granted && typeof plugin.requestStepPermissions === "function") {
          await plugin.requestStepPermissions();
        }
      } else if (typeof plugin.checkPermissions === "function") {
        const perm = await plugin.checkPermissions();
        if (!perm.granted && typeof plugin.requestPermissions === "function") {
          await plugin.requestPermissions();
        }
      }

      // 2. Start 24/7 background tracking service
      if (typeof plugin.startBackgroundTracking === "function") {
        const startRes = await plugin.startBackgroundTracking();
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

  private syncStepsToEngine(data: NativeStepData) {
    if (typeof data.steps === "number" && data.steps >= 0) {
      fitnessWatchSensor.syncNativeBackgroundSteps(
        data.steps,
        data.caloriesBurned || Math.round(data.steps * 0.043),
        data.distanceKm || parseFloat((data.steps * 0.00075).toFixed(2))
      );
    }
  }

  public async startBackgroundTracking(): Promise<boolean> {
    const plugin = getNativePlugin();
    if (!plugin || typeof plugin.startBackgroundTracking !== "function") return false;
    try {
      const res = await plugin.startBackgroundTracking();
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
}

export const nativeStepCounter = new NativeStepCounterService();
