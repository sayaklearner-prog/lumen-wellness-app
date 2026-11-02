import { Platform } from "react-native";
import { storage } from "@/services/storage";
import { getProfileState, saveProfileState, setKV, getKV } from "@/services/db";

export interface GoogleUser {
  id: string; // Google user sub ID
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  photoUrl?: string;
  provider: "google";
  signedInAt: string;
}

// User's Official Google Cloud OAuth Client ID
export const GOOGLE_CLIENT_ID = "949098534684-o0kfrlmr8coj9jjcc7m17rkgu5lkach5.apps.googleusercontent.com";

// Hosted Auth Bridge URL on verified Firebase project
export const OAUTH_HOSTED_REDIRECT_URI = "https://lumen-os-4e785.web.app/auth-callback.html";

/**
 * Returns the configured redirect URI based on current runtime
 */
export function getGoogleRedirectUri(): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/+$/, "");
    // If running in development web server or live hosted web (not Capacitor Android webview)
    if (origin.includes("localhost:8081") || origin.includes("lumen-os-4e785")) {
      return origin;
    }
  }
  // Mobile app (Android / Capacitor localhost): redirect through hosted Firebase auth bridge
  return OAUTH_HOSTED_REDIRECT_URI;
}

/**
 * Builds the official Google OAuth 2.0 authorization URL
 * pointing directly to accounts.google.com in the browser
 */
export function buildGoogleOAuthUrl(customRedirectUri?: string): string {
  const redirectUri = customRedirectUri || getGoogleRedirectUri();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "token id_token",
    scope: "openid profile email",
    nonce: String(Date.now()),
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Decodes a JWT token without external libraries
 */
export function decodeJwtPayload(jwt: string): any {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn("Failed to decode JWT:", err);
    return null;
  }
}

/**
 * Fetches user profile from Google UserInfo API using access_token
 */
export async function fetchGoogleProfile(accessToken: string): Promise<Partial<GoogleUser> | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.sub || `google-${Date.now()}`,
      email: data.email,
      name: data.name || data.email?.split("@")[0],
      givenName: data.given_name,
      familyName: data.family_name,
      photoUrl: data.picture,
    };
  } catch (err) {
    console.warn("fetchGoogleProfile error:", err);
    return null;
  }
}

/**
 * Parses Google OAuth redirect URL or hash string (#access_token=...&id_token=...)
 */
export async function parseGoogleAuthRedirect(urlOrHash: string): Promise<GoogleUser | null> {
  try {
    let hashOrQuery = "";
    if (urlOrHash.includes("#")) {
      hashOrQuery = urlOrHash.substring(urlOrHash.indexOf("#") + 1);
    } else if (urlOrHash.includes("?")) {
      hashOrQuery = urlOrHash.substring(urlOrHash.indexOf("?") + 1);
    } else {
      hashOrQuery = urlOrHash;
    }

    const params = new URLSearchParams(hashOrQuery);
    const accessToken = params.get("access_token");
    const idToken = params.get("id_token");

    if (!accessToken && !idToken) return null;

    let userEmail = "";
    let userName = "";
    let userId = "";
    let userPicture = "";

    // 1. Try decoding id_token JWT
    if (idToken) {
      const decoded = decodeJwtPayload(idToken);
      if (decoded) {
        userEmail = decoded.email || "";
        userName = decoded.name || "";
        userId = decoded.sub || "";
        userPicture = decoded.picture || "";
      }
    }

    // 2. Fetch fresh userinfo from Google API if accessToken available
    if (accessToken) {
      const liveInfo = await fetchGoogleProfile(accessToken);
      if (liveInfo) {
        if (liveInfo.email) userEmail = liveInfo.email;
        if (liveInfo.name) userName = liveInfo.name;
        if (liveInfo.id) userId = liveInfo.id;
        if (liveInfo.photoUrl) userPicture = liveInfo.photoUrl;
      }
    }

    if (!userEmail) return null;

    const formattedName =
      userName ||
      userEmail.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const user: GoogleUser = {
      id: userId || `google-${Date.now()}`,
      email: userEmail.toLowerCase(),
      name: formattedName,
      photoUrl: userPicture,
      provider: "google",
      signedInAt: new Date().toISOString(),
    };

    return user;
  } catch (err) {
    console.warn("parseGoogleAuthRedirect error:", err);
    return null;
  }
}

/**
 * Persists Google Authentication Session into Master SQLite Database & Storage
 */
export async function saveGoogleUserSession(
  user: GoogleUser,
  isSignUp: boolean = true
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
