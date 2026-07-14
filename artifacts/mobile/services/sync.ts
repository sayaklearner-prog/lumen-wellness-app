import { Platform } from "react-native";
import { getPendingLogs, deleteOfflineLog } from "./db";
import { storage } from "./storage";

let isSyncing = false;

export function setupOfflineSync(onSyncCompleted?: () => void) {
  if (Platform.OS === "web") return; // NetInfo not available on web

  const NetInfo = require("@react-native-community/netinfo").default;
  NetInfo.addEventListener((state: any) => {
    if (state.isConnected && state.isInternetReachable) {
      console.log("Internet restored. Flushing pending local logs to FastAPI...");
      triggerSync(onSyncCompleted);
    }
  });
}

export async function triggerSync(onSyncCompleted?: () => void) {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const logs = await getPendingLogs();
    if (logs.length === 0) {
      isSyncing = false;
      return;
    }

    const token = await storage.getItem("lumen_auth_token");
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000";

    for (const log of logs) {
      try {
        const res = await fetch(`${baseUrl}${log.endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: log.payload,
        });

        if (res.ok) {
          await deleteOfflineLog(log.id);
          console.log(`Synced offline log #${log.id} to ${log.endpoint}`);
        }
      } catch (err) {
        console.error(`Failed to sync log #${log.id}`, err);
      }
    }

    onSyncCompleted?.();
  } finally {
    isSyncing = false;
  }
}
