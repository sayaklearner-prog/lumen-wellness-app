import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { storage } from "@/services/storage";
import { getProfileState, saveProfileState, setKV, getKV } from "@/services/db";

export interface GoogleUser {
  id: string; // Google user sub ID
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  photoUrl?: string;
  accessToken?: string;
  idToken?: string;
  provider: "google";
  signedInAt: string;
}

/**
 * Google OAuth 2.0 Configuration
 * When the user provides their OAuth key, they can specify it in EXPO_PUBLIC_GOOGLE_CLIENT_ID
 * or replace the fallback placeholder below.
 */
export const GOOGLE_OAUTH_CONFIG = {
  // Primary Client ID (Web / Universal)
  clientId:
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",

  // Platform-specific Client IDs if required by Google Console
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    "",

  androidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    "",

  scopes: ["openid", "profile", "email"],
  authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  userInfoEndpoint: "https://www.googleapis.com/oauth2/v3/userinfo",
};

/**
 * Returns the currently active Google Client ID (from env or stored preference)
 */
export async function getActiveGoogleClientId(): Promise<string> {
  const envId =
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (envId && envId.trim() && !envId.startsWith("YOUR_GOOGLE_CLIENT_ID")) {
    return envId.trim();
  }

  try {
    const stored = await storage.getItem("lumen_google_client_id");
    if (stored && stored.trim() && !stored.startsWith("YOUR_GOOGLE_CLIENT_ID")) {
      return stored.trim();
    }
  } catch {}

  return "";
}

/**
 * Persists a user-configured Google OAuth 2.0 Client ID
 */
export async function setActiveGoogleClientId(clientId: string): Promise<void> {
  const clean = clientId.trim();
  await storage.setItem("lumen_google_client_id", clean);
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem("lumen_google_client_id", clean);
  }
}

/**
 * Returns true if a real, valid Google OAuth Client ID has been configured.
 */
export function isGoogleOAuthConfigured(explicitClientId?: string): boolean {
  const cid = (explicitClientId || GOOGLE_OAUTH_CONFIG.clientId)?.trim();
  if (!cid) return false;
  if (cid.startsWith("YOUR_GOOGLE_CLIENT_ID")) return false;
  return true;
}

/**
 * Computes the OAuth redirect URI for mobile and web
 */
export function getGoogleRedirectUri(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/oauth/google`;
    }
    return "https://lumen-wellness-app.onrender.com/oauth/google";
  }

  // Mobile scheme redirect
  return Linking.createURL("oauth/google");
}

/**
 * Builds the official Google OAuth 2.0 authorization URL
 */
export function buildGoogleAuthUrl(
  prompt: "select_account" | "consent" = "select_account",
  overrideClientId?: string
): string {
  const activeClientId =
    overrideClientId ||
    (Platform.OS === "android" && GOOGLE_OAUTH_CONFIG.androidClientId
      ? GOOGLE_OAUTH_CONFIG.androidClientId
      : Platform.OS === "ios" && GOOGLE_OAUTH_CONFIG.iosClientId
      ? GOOGLE_OAUTH_CONFIG.iosClientId
      : GOOGLE_OAUTH_CONFIG.clientId);

  const redirectUri = getGoogleRedirectUri();
  const scopeStr = GOOGLE_OAUTH_CONFIG.scopes.join(" ");
  const state = Math.random().toString(36).substring(2, 15);
  const nonce = Date.now().toString();

  const params = new URLSearchParams({
    client_id: activeClientId,
    redirect_uri: redirectUri,
    response_type: "token id_token",
    scope: scopeStr,
    prompt,
    state,
    nonce,
  });

  return `${GOOGLE_OAUTH_CONFIG.authEndpoint}?${params.toString()}`;
}

/**
 * Fetches Google User Profile information using an access token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<Partial<GoogleUser> | null> {
  try {
    const res = await fetch(GOOGLE_OAUTH_CONFIG.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      console.warn("Failed to fetch Google userinfo:", res.status);
      return null;
    }

    const data = await res.json();
    return {
      id: data.sub || data.id,
      email: data.email,
      name: data.name || data.given_name || "Google User",
      givenName: data.given_name,
      familyName: data.family_name,
      photoUrl: data.picture,
    };
  } catch (err) {
    console.warn("fetchGoogleUserInfo error:", err);
    return null;
  }
}

/**
 * Parses parameters from incoming OAuth redirect URL
 */
export function parseOAuthRedirectUrl(url: string): {
  accessToken?: string;
  idToken?: string;
  error?: string;
} {
  try {
    let accessToken: string | undefined;
    let idToken: string | undefined;
    let error: string | undefined;

    const qIndex = url.indexOf("?");
    const hIndex = url.indexOf("#");

    if (qIndex !== -1) {
      const qStr = hIndex !== -1 && hIndex > qIndex ? url.substring(qIndex + 1, hIndex) : url.substring(qIndex + 1);
      const qParams = new URLSearchParams(qStr);
      accessToken = qParams.get("access_token") || undefined;
      idToken = qParams.get("id_token") || undefined;
      error = qParams.get("error") || undefined;
    }

    if (hIndex !== -1) {
      const hStr = url.substring(hIndex + 1);
      const hParams = new URLSearchParams(hStr);
      if (!accessToken) accessToken = hParams.get("access_token") || undefined;
      if (!idToken) idToken = hParams.get("id_token") || undefined;
      if (!error) error = hParams.get("error") || undefined;
    }

    return { accessToken, idToken, error };
  } catch {
    return {};
  }
}

/**
 * Persists Google Authentication Session into Master SQLite Database & Storage
 */
export async function saveGoogleUserSession(
  user: GoogleUser,
  isSignUp: boolean = false
): Promise<void> {
  const userJson = JSON.stringify(user);

  // 1. Storage persistence
  await storage.setItem("lumen_auth_token", "authenticated");
  await storage.setItem("lumen_google_user", userJson);
  await storage.setItem("lumen_auth_provider", "google");

  // 2. Synchronize with master SQLite database
  try {
    await setKV("lumen_google_user", userJson);
    await setKV("lumen_auth_provider", "google");

    // Update Profile state in DB with real Google User name
    const existing = await getProfileState();
    if (existing) {
      await saveProfileState({
        ...existing,
        name: user.name || existing.name,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await saveProfileState({
        id: "primary",
        name: user.name || "User",
        mode: "standard",
        dailyCalorieTarget: 2100,
        dailyProteinTarget: 110,
        dailySleepTargetHours: 8,
        dailyStepsTarget: 9000,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("Error saving Google profile to master DB:", err);
  }

  // 3. Web localStorage mirrors
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem("lumen_authenticated", "true");
    localStorage.setItem("lumen_google_user", userJson);
    localStorage.setItem("lumen_auth_provider", "google");
  }

  // 4. Onboarding route control
  if (isSignUp) {
    await storage.setItem("lumen_in_onboarding", "true");
    await storage.removeItem("lumen_onboarding_completed");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_in_onboarding", "true");
      localStorage.removeItem("lumen_onboarding_completed");
    }
  } else {
    await storage.removeItem("lumen_in_onboarding");
    await storage.setItem("lumen_onboarding_completed", "true");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.removeItem("lumen_in_onboarding");
      localStorage.setItem("lumen_onboarding_completed", "true");
    }
  }
}

/**
 * Retrieves the currently saved Google User from storage/DB
 */
export async function getStoredGoogleUser(): Promise<GoogleUser | null> {
  try {
    const raw = await storage.getItem("lumen_google_user");
    if (raw) return JSON.parse(raw);

    const kvRaw = await getKV("lumen_google_user");
    if (kvRaw) return JSON.parse(kvRaw);

    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      const webRaw = localStorage.getItem("lumen_google_user");
      if (webRaw) return JSON.parse(webRaw);
    }
  } catch {}
  return null;
}

/**
 * Clears Google Authentication Session
 */
export async function signOutGoogleUser(): Promise<void> {
  await storage.removeItem("lumen_google_user");
  await storage.removeItem("lumen_auth_token");
  await storage.removeItem("lumen_auth_provider");
  await storage.removeItem("lumen_in_onboarding");
  await storage.removeItem("lumen_onboarding_completed");

  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.removeItem("lumen_google_user");
    localStorage.removeItem("lumen_authenticated");
    localStorage.removeItem("lumen_auth_provider");
    localStorage.removeItem("lumen_in_onboarding");
    localStorage.removeItem("lumen_onboarding_completed");
  }
}
