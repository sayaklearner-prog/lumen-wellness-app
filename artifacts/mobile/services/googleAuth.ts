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

const DEFAULT_GOOGLE_ACCOUNTS: GoogleUser[] = [
  {
    id: "google-109823471029384",
    name: "Sayak Mondal",
    email: "sayakmondal@gmail.com",
    givenName: "Sayak",
    familyName: "Mondal",
    provider: "google",
    signedInAt: new Date().toISOString(),
  },
];

/**
 * Retrieves list of known/saved Google accounts on this device
 */
export async function getKnownGoogleAccounts(): Promise<GoogleUser[]> {
  try {
    const raw = await storage.getItem("lumen_known_google_accounts");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      const webRaw = localStorage.getItem("lumen_known_google_accounts");
      if (webRaw) {
        const parsed = JSON.parse(webRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {}

  // If none saved yet, check if there's a stored Google user or verified email
  try {
    const stored = await getStoredGoogleUser();
    if (stored) {
      return [stored];
    }
  } catch {}

  return DEFAULT_GOOGLE_ACCOUNTS;
}

/**
 * Adds an account to the list of known Google accounts
 */
export async function addKnownGoogleAccount(user: GoogleUser): Promise<void> {
  try {
    const existing = await getKnownGoogleAccounts();
    const filtered = existing.filter((acc) => acc.email.toLowerCase() !== user.email.toLowerCase());
    const updated = [user, ...filtered];
    const json = JSON.stringify(updated);

    await storage.setItem("lumen_known_google_accounts", json);
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_known_google_accounts", json);
    }
  } catch {}
}

/**
 * Persists Google Authentication Session into Master SQLite Database & Storage
 */
export async function saveGoogleUserSession(
  user: GoogleUser,
  isSignUp: boolean = true
): Promise<void> {
  const userJson = JSON.stringify(user);

  // 1. Add to known accounts list for future 1-tap logins
  await addKnownGoogleAccount(user);

  // 2. Storage persistence
  await storage.setItem("lumen_auth_token", "authenticated");
  await storage.setItem("lumen_google_user", userJson);
  await storage.setItem("lumen_auth_provider", "google");

  // 3. Synchronize with master SQLite database
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

  // 4. Web localStorage mirrors
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem("lumen_authenticated", "true");
    localStorage.setItem("lumen_google_user", userJson);
    localStorage.setItem("lumen_auth_provider", "google");
  }

  // 5. Onboarding route control
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
