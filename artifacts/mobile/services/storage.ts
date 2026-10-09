import { getKV, setKV, deleteKV, getAllKVKeys } from "./db";

// In-memory cache for ultra-fast synchronous cache hits + immediate consistency
const memoryCache = new Map<string, string>();

/**
 * Lumen Unified Storage Service
 * Backed by Lumen Master SQLite Database (native) and Persistent LocalStorage (web).
 * Eliminates the Android 2KB SecureStore ceiling, allowing unlimited JSON payloads
 * to persist permanently across app closures, backgrounding, and device restarts.
 */
export const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) ?? null;
    }
    try {
      const val = await getKV(key);
      if (val !== null) {
        memoryCache.set(key, val);
      }
      return val;
    } catch (err) {
      console.warn(`storage.getItem("${key}") error:`, err);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memoryCache.set(key, value);
    try {
      await setKV(key, value);
    } catch (err) {
      console.error(`storage.setItem("${key}") persistence failed:`, err);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    memoryCache.delete(key);
    try {
      await deleteKV(key);
    } catch (err) {
      console.warn(`storage.removeItem("${key}") error:`, err);
    }
  },

  getAllKeys: async (): Promise<string[]> => {
    try {
      return await getAllKVKeys();
    } catch {
      return Array.from(memoryCache.keys());
    }
  },

  clear: async (): Promise<void> => {
    memoryCache.clear();
    try {
      const keys = await getAllKVKeys();
      for (const k of keys) {
        await deleteKV(k);
      }
    } catch (err) {
      console.warn("storage.clear error:", err);
    }
  },
};
