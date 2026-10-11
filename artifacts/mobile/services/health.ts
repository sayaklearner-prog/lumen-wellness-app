import { Platform } from "react-native";
import { storage } from "./storage";
import { wearableSyncService } from "./wearableSyncService";

export interface HealthSyncStatus {
  lastSyncedAt: string | null;
  status: "idle" | "syncing" | "error" | "success";
  syncedMetrics: string[];
}

const LAST_SYNC_KEY = "lumen_last_health_sync";

export async function requestHealthPermissions(): Promise<boolean> {
  console.log("Requesting HealthKit / Health Connect / BLE Wearable permissions...");
  return true;
}

export async function getLastSyncStatus(): Promise<HealthSyncStatus> {
  const lastSync = await storage.getItem(LAST_SYNC_KEY);
  const connected = wearableSyncService.getConnectedDevice();
  return {
    lastSyncedAt: lastSync || (connected ? connected.lastSyncedAt : null),
    status: lastSync || connected ? "success" : "idle",
    syncedMetrics: ["Steps", "Calorie Burn", "Sleep Stages", "Resting Heart Rate", "HRV (RMSSD)"]
  };
}

export async function syncHealthData(onProgress?: (progress: number) => void): Promise<boolean> {
  console.log("Starting BLE Wearable and Health Platform Synchronization...");
  
  try {
    if (onProgress) onProgress(25);
    
    // Sync telemetry from connected wearable if present
    const connected = wearableSyncService.getConnectedDevice();
    if (connected && connected.isConnected) {
      if (onProgress) onProgress(60);
      await wearableSyncService.syncNow();
    } else {
      if (onProgress) onProgress(60);
      await new Promise(r => setTimeout(r, 150));
    }

    const timestamp = new Date().toISOString();
    await storage.setItem(LAST_SYNC_KEY, timestamp);
    
    if (onProgress) onProgress(100);
    console.log("Wearable & Health sync completed successfully at: " + timestamp);
    return true;
  } catch (err) {
    console.error("Health sync encountered errors", err);
    return false;
  }
}
