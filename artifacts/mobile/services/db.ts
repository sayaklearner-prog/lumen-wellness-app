import { Platform } from "react-native";

// SQLite database connector for offline queue (native only)
let dbInstance: any = null;

export interface OfflineLog {
  id: number;
  category: string;
  endpoint: string;
  payload: string;
  queuedAt: string;
}

export async function getDb() {
  if (Platform.OS === "web") return null;
  if (dbInstance) return dbInstance;
  
  try {
    const SQLite = require("expo-sqlite");
    dbInstance = await SQLite.openDatabaseAsync("lumen_offline.db");
    
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        payload TEXT NOT NULL,
        queued_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn("SQLite not available on this platform", err);
    return null;
  }
  
  return dbInstance;
}

export async function queueOfflineLog(category: string, endpoint: string, payload: any) {
  const db = await getDb();
  if (!db) {
    console.warn("Offline queue unavailable (web mode). Skipping log.");
    return;
  }
  
  await db.runAsync(
    `INSERT INTO offline_logs (category, endpoint, payload) VALUES (?, ?, ?)`,
    category,
    endpoint,
    JSON.stringify(payload)
  );
}

export async function getPendingLogs(): Promise<OfflineLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  const rows = await db.getAllAsync(`SELECT * FROM offline_logs ORDER BY id ASC`);
  return rows as OfflineLog[];
}

export async function deleteOfflineLog(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.runAsync(`DELETE FROM offline_logs WHERE id = ?`, id);
}
