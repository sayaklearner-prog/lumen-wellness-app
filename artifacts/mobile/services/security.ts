import { Platform } from "react-native";
import { storage } from "./storage";

const SECURITY_ENABLED_KEY = "lumen_biometrics_enabled";

export async function isBiometricsSupported(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const LocalAuthentication = require("expo-local-authentication");
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await storage.setItem(SECURITY_ENABLED_KEY, enabled ? "true" : "false");
}

export async function getBiometricsEnabled(): Promise<boolean> {
  const value = await storage.getItem(SECURITY_ENABLED_KEY);
  return value === "true";
}

export async function authenticateWithBiometrics(reason = "Unlock your Lumen Health OS"): Promise<boolean> {
  if (Platform.OS === "web") return true; // Skip biometrics on web
  try {
    const supported = await isBiometricsSupported();
    if (!supported) return true;

    const LocalAuthentication = require("expo-local-authentication");
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: "Use PIN passcode",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch (err) {
    console.error("Biometric authentication failed", err);
    return false;
  }
}
