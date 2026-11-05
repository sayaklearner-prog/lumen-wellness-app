/**
 * LUMEN USER TELEMETRY & GOOGLE SHEETS AUTO-SYNC
 *
 * Automatically relays user authentication & profile telemetry to the
 * developer's Google Sheet via Google Apps Script Web App.
 *
 * Features:
 * - Silent non-blocking execution (never interrupts UI)
 * - Offline queue fallback (stores pending events if network is absent)
 * - Automatic retry on next app session
 */

import { Platform } from "react-native";
import { storage } from "./storage";

export interface UserTelemetryPayload {
  name?: string;
  email?: string;
  event:
    | "New Signup"
    | "User Login"
    | "Google Sign-In"
    | "Profile Update"
    | "System Verification";
  timestamp?: string;
  platform?: string;
  healthMode?: string;
  calorieTarget?: string | number;
  sleepTarget?: string | number;
  stepsTarget?: string | number;
  appVersion?: string;
}

const DEFAULT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbztZswgy51yZvpA21CxtYiGVizELYmfX0U2eIufOgMqKE1vzCCEL14oRIdirscXYVJlxw/exec";

const QUEUE_STORAGE_KEY = "lumen_pending_sheets_telemetry";

class SheetsTelemetryService {
  private webhookUrl: string = DEFAULT_WEBHOOK_URL;
  private isFlushingQueue: boolean = false;

  /**
   * Log user event to Google Sheet
   */
  public async logUserToSheet(
    payload: Partial<UserTelemetryPayload> & { event: UserTelemetryPayload["event"] }
  ): Promise<boolean> {
    const formattedDate = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const fullPayload: UserTelemetryPayload = {
      timestamp: payload.timestamp || formattedDate,
      name: payload.name || "User",
      email: payload.email || "N/A",
      event: payload.event,
      platform: payload.platform || Platform.OS,
      healthMode: payload.healthMode || "N/A",
      calorieTarget: payload.calorieTarget ? String(payload.calorieTarget) : "N/A",
      sleepTarget: payload.sleepTarget ? String(payload.sleepTarget) : "N/A",
      stepsTarget: payload.stepsTarget ? String(payload.stepsTarget) : "N/A",
      appVersion: payload.appVersion || "1.0.0",
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      // We use text/plain to avoid unwanted CORS preflight blocks on web
      // Google Apps Script doPost(e) parses e.postData.contents as JSON
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(fullPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok || res.status === 200 || res.type === "opaque") {
        console.log("[SheetsTelemetry] Successfully logged:", fullPayload.event, fullPayload.email);
        // Try flushing any backlog
        this.flushPendingQueue().catch(() => {});
        return true;
      } else {
        throw new Error(`HTTP status ${res.status}`);
      }
    } catch (err: any) {
      console.warn("[SheetsTelemetry] Network error, queueing payload:", err?.message);
      await this.enqueuePayload(fullPayload);
      return false;
    }
  }

  /**
   * Queue payload locally when device has no internet
   */
  private async enqueuePayload(payload: UserTelemetryPayload): Promise<void> {
    try {
      const raw = await storage.getItem(QUEUE_STORAGE_KEY);
      const queue: UserTelemetryPayload[] = raw ? JSON.parse(raw) : [];
      queue.push(payload);
      // Keep maximum 50 queued records to prevent unbounded storage
      if (queue.length > 50) queue.shift();
      await storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.warn("[SheetsTelemetry] Queue save error:", err);
    }
  }

  /**
   * Flush queued offline payloads once connection returns
   */
  public async flushPendingQueue(): Promise<void> {
    if (this.isFlushingQueue) return;
    this.isFlushingQueue = true;

    try {
      const raw = await storage.getItem(QUEUE_STORAGE_KEY);
      if (!raw) {
        this.isFlushingQueue = false;
        return;
      }

      const queue: UserTelemetryPayload[] = JSON.parse(raw);
      if (!Array.isArray(queue) || queue.length === 0) {
        this.isFlushingQueue = false;
        return;
      }

      const remaining: UserTelemetryPayload[] = [];

      for (const item of queue) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          await fetch(this.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(item),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
        } catch {
          remaining.push(item);
        }
      }

      if (remaining.length > 0) {
        await storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
      } else {
        await storage.removeItem(QUEUE_STORAGE_KEY);
      }
    } catch (err) {
      console.warn("[SheetsTelemetry] Queue flush error:", err);
    } finally {
      this.isFlushingQueue = false;
    }
  }
}

export const sheetsTelemetryService = new SheetsTelemetryService();
