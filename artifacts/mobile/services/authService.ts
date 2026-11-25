/**
 * LUMEN AUTH & OTP VERIFICATION SERVICE
 *
 * Real Email OTP dispatch and verification powered by the Lumen Google Apps Script
 * Mailer (`MailApp.sendEmail` + `CacheService` hashed OTP verification), with optional
 * real SMTP backend fallback when configured.
 *
 * Strictly enforces genuine inbox verification — never fakes or auto-bypasses OTPs.
 */

import { Platform } from "react-native";
import { storage } from "./storage";
import { LUMEN_APPS_SCRIPT_URL } from "./sheetsTelemetryService";

function getOtpAppsScriptUrl(): string {
  return process.env.EXPO_PUBLIC_OTP_WEBHOOK_URL || LUMEN_APPS_SCRIPT_URL;
}

function getBackendApiUrl(): string | null {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.hostname?.includes("onrender.com")) {
    return window.location.origin;
  }
  return null;
}

export interface SendOtpResult {
  success: boolean;
  message?: string;
  error?: string;
  expiresInSeconds?: number;
  cooldownRemainingSeconds?: number;
}

export interface VerifyOtpResult {
  success: boolean;
  verified?: boolean;
  token?: string;
  email?: string;
  error?: string;
  remainingAttempts?: number;
}

class AuthService {
  /**
   * Request a real 6-digit verification code sent to the user's email inbox.
   */
  public async sendOtp(
    email: string,
    purpose: "signup" | "signin" = "signup"
  ): Promise<SendOtpResult> {
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    // 1. Primary: Google Apps Script Mailer (HTTPS text/plain avoids CORS preflight)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(getOtpAppsScriptUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "send_otp",
          email: cleanEmail,
          purpose,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json().catch(() => null);

      if (data?.success === true && data?.otpDispatched === true) {
        return {
          success: true,
          message: data.message || `Verification code sent to ${cleanEmail}`,
          expiresInSeconds: data.expiresInSeconds || 300,
        };
      }

      if (data?.success === false && data?.error) {
        return {
          success: false,
          error: data.error,
          cooldownRemainingSeconds: data.cooldownRemainingSeconds,
        };
      }

      // Detect if the old telemetry-only Apps Script is still deployed
      if (data?.status === "success" && !data?.otpDispatched) {
        return {
          success: false,
          error:
            "Email OTP mailer is not yet active on the Google Apps Script deployment. Please update Code.gs and redeploy.",
        };
      }
    } catch (err: any) {
      console.warn("[AuthService] Apps Script OTP send failed:", err?.message);
    }

    // 2. Optional Backend API fallback if EXPO_PUBLIC_API_URL with real SMTP is configured
    const backendUrl = getBackendApiUrl();
    if (backendUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(`${backendUrl}/api/auth/send-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ email: cleanEmail, purpose }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => null);

        if (response.ok && data?.success && !data?.dev_otp && !data?.devOtp) {
          return {
            success: true,
            message: data.message || `Verification code sent to ${cleanEmail}`,
            expiresInSeconds: data.expiresInSeconds || data.expires_in_seconds || 300,
          };
        }
        if (data?.error || data?.detail) {
          return {
            success: false,
            error: data.error || data.detail,
            cooldownRemainingSeconds: data.cooldownRemainingSeconds,
          };
        }
      } catch (err: any) {
        console.warn("[AuthService] Backend OTP send failed:", err?.message);
      }
    }

    return {
      success: false,
      error: "Unable to send verification email right now. Please check your internet connection and try again.",
    };
  }

  /**
   * Verify the 6-digit OTP code entered by the user against the server-side store.
   */
  public async verifyOtp(
    email: string,
    otp: string,
    purpose: "signup" | "signin" = "signup"
  ): Promise<VerifyOtpResult> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      return {
        success: false,
        error: "Please enter the complete 6-digit verification code.",
      };
    }

    // 1. Primary: Google Apps Script Mailer verification
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(getOtpAppsScriptUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "verify_otp",
          email: cleanEmail,
          otp: cleanOtp,
          purpose,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json().catch(() => null);

      if (data?.success === true && data?.verified === true) {
        const token = data.token || "verified";
        await this.saveVerifiedEmailSession(cleanEmail, token);
        return {
          success: true,
          verified: true,
          token,
          email: cleanEmail,
        };
      }

      if (data?.success === false && data?.error) {
        return {
          success: false,
          error: data.error,
          remainingAttempts: data.remainingAttempts,
        };
      }

      if (data?.status === "success" && data?.verified !== true) {
        return {
          success: false,
          error:
            "Email OTP verification handler is not active on the Google Apps Script deployment. Please redeploy Code.gs.",
        };
      }
    } catch (err: any) {
      console.warn("[AuthService] Apps Script OTP verify failed:", err?.message);
    }

    // 2. Optional Backend API fallback if EXPO_PUBLIC_API_URL is explicitly configured
    const backendUrl = getBackendApiUrl();
    if (backendUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(`${backendUrl}/api/auth/verify-otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ email: cleanEmail, otp: cleanOtp, purpose }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => null);

        if (response.ok && data?.success && (data.verified || data.token)) {
          await this.saveVerifiedEmailSession(cleanEmail, data.token || "verified");
          return {
            success: true,
            verified: true,
            token: data.token,
            email: cleanEmail,
          };
        }
        if (data?.error || data?.detail) {
          return {
            success: false,
            error: data.error || data.detail,
            remainingAttempts: data.remainingAttempts,
          };
        }
      } catch (err: any) {
        console.warn("[AuthService] Backend OTP verify failed:", err?.message);
      }
    }

    return {
      success: false,
      error: "Unable to verify code right now. Please check your connection and try again.",
    };
  }

  /**
   * Save verified email and session flags to persistent storage
   */
  public async saveVerifiedEmailSession(email: string, _token: string): Promise<void> {
    await storage.setItem("lumen_verified_email", email);
    await storage.setItem("lumen_auth_token", "authenticated");

    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_verified_email", email);
      localStorage.setItem("lumen_authenticated", "true");
    }
  }

  /**
   * Retrieve the currently verified email
   */
  public async getVerifiedEmail(): Promise<string | null> {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      const webEmail = localStorage.getItem("lumen_verified_email");
      if (webEmail) return webEmail;

      const gUser = localStorage.getItem("lumen_google_user");
      if (gUser) {
        try {
          const parsed = JSON.parse(gUser);
          if (parsed?.email) return parsed.email;
        } catch {}
      }
    }

    const email = await storage.getItem("lumen_verified_email");
    if (email) return email;

    const gUser = await storage.getItem("lumen_google_user");
    if (gUser) {
      try {
        const parsed = JSON.parse(gUser);
        if (parsed?.email) return parsed.email;
      } catch {}
    }

    return null;
  }

  /**
   * Clear verified email session
   */
  public async clearVerifiedEmail(): Promise<void> {
    await storage.removeItem("lumen_verified_email");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.removeItem("lumen_verified_email");
    }
  }
}

export const authService = new AuthService();
