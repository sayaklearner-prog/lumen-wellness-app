/**
 * LUMEN REAL-TIME LOCATION & GEOGRAPHIC TELEMETRY ENGINE
 *
 * Provides:
 * 1. Native / Web OS Geolocation (GPS Coordinates via navigator.geolocation / Capacitor)
 * 2. Automatic Reverse Geocoding (Converts lat/long into City, Region, Country)
 * 3. Silent Coarse IP Fallback (If user denies GPS or GPS is unavailable, detects City/Country via IP)
 * 4. Local Caching & Persistence (Prevents continuous GPS battery drain)
 * 5. Automatic Integration with Lumen Sheets Telemetry
 */

import { Platform } from "react-native";
import { storage } from "./storage";

export interface UserLocationData {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  formattedLocation: string;
  source: "gps" | "ip_fallback" | "cached" | "unknown";
  timestamp: string;
  permissionGranted: boolean;
}

const STORAGE_LOCATION_KEY = "lumen_user_location";
const STORAGE_PERM_KEY = "lumen_location_permission_status";
const STORAGE_PROMPTED_KEY = "lumen_location_prompted";

// Reverse geocodes latitude/longitude into human-readable city, state, country
async function reverseGeocodeCoords(
  latitude: number,
  longitude: number
): Promise<{ city: string | null; region: string | null; country: string | null; formatted: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    // Free client-side reverse geocoding
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || null;
      const region = data.principalSubdivision || data.region || null;
      const country = data.countryName || data.countryCode || null;
      const parts = [city, region, country].filter(Boolean);
      return {
        city,
        region,
        country,
        formatted: parts.length > 0 ? parts.join(", ") : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      };
    }
  } catch {
    // Reverse geocode failed or timed out, fallback to coordinates
  }

  return {
    city: null,
    region: null,
    country: null,
    formatted: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
  };
}

// Coarse IP-based fallback if GPS is denied, unavailable, or on first session
async function fetchCoarseIpLocation(): Promise<UserLocationData | null> {
  // Provider 1: freeipapi.com
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://freeipapi.com/api/json", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const city = data.cityName || data.city || null;
      const region = data.regionName || data.region || null;
      const country = data.countryName || data.country || null;
      const lat = data.latitude ? Number(data.latitude) : null;
      const lon = data.longitude ? Number(data.longitude) : null;
      const parts = [city, region, country].filter(Boolean);

      return {
        latitude: lat,
        longitude: lon,
        city,
        region,
        country,
        formattedLocation: parts.length > 0 ? parts.join(", ") : "Unknown Region",
        source: "ip_fallback",
        timestamp: new Date().toISOString(),
        permissionGranted: false,
      };
    }
  } catch {}

  // Provider 2: ipwhois.app fallback
  try {
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), 3500);
    const res2 = await fetch("https://ipwhois.app/json/", { signal: controller2.signal });
    clearTimeout(timer2);

    if (res2.ok) {
      const data2 = await res2.json();
      const city = data2.city || null;
      const region = data2.region || null;
      const country = data2.country || null;
      const lat = data2.latitude ? Number(data2.latitude) : null;
      const lon = data2.longitude ? Number(data2.longitude) : null;
      const parts = [city, region, country].filter(Boolean);

      return {
        latitude: lat,
        longitude: lon,
        city,
        region,
        country,
        formattedLocation: parts.length > 0 ? parts.join(", ") : "Unknown Region",
        source: "ip_fallback",
        timestamp: new Date().toISOString(),
        permissionGranted: false,
      };
    }
  } catch {}

  return null;
}

class LocationService {
  private memoryLocation: UserLocationData | null = null;
  private isFetching = false;

  /**
   * Retrieves the cached location from local persistent storage
   */
  public async getStoredLocation(): Promise<UserLocationData | null> {
    if (this.memoryLocation) return this.memoryLocation;
    try {
      const raw = await storage.getItem(STORAGE_LOCATION_KEY);
      if (raw) {
        this.memoryLocation = JSON.parse(raw);
        return this.memoryLocation;
      }
    } catch (e) {
      console.warn("[LocationService] getStoredLocation error:", e);
    }
    return null;
  }

  /**
   * Checks whether the user has granted or denied location permission
   */
  public async checkPermission(): Promise<{
    granted: boolean;
    status: "granted" | "denied" | "pending";
    isPrompted: boolean;
  }> {
    try {
      const permStatus = (await storage.getItem(STORAGE_PERM_KEY)) as
        | "granted"
        | "denied"
        | null;
      const prompted = (await storage.getItem(STORAGE_PROMPTED_KEY)) === "true";

      if (permStatus === "granted") {
        return { granted: true, status: "granted", isPrompted: true };
      }
      if (permStatus === "denied") {
        return { granted: false, status: "denied", isPrompted: true };
      }
      return { granted: false, status: "pending", isPrompted: prompted };
    } catch {
      return { granted: false, status: "pending", isPrompted: false };
    }
  }

  /**
   * Mark that the location prompt was shown to avoid repeatedly bothering the user
   */
  public async markPrompted(): Promise<void> {
    await storage.setItem(STORAGE_PROMPTED_KEY, "true");
  }

  /**
   * Requests real-time GPS location access from the OS / browser.
   * If granted: resolves coordinates & reverse-geocodes city/country.
   * If denied: smoothly executes the coarse IP fallback so telemetry still captures region.
   */
  public async requestLocationPermission(): Promise<{
    granted: boolean;
    location: UserLocationData | null;
  }> {
    await this.markPrompted();

    // Check if navigator.geolocation is available (Web, Mobile WebView, Capacitor)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const coords = await new Promise<{ latitude: number; longitude: number } | null>(
          (resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                });
              },
              (err) => {
                console.warn("[LocationService] GPS denied or unavailable:", err?.message);
                resolve(null);
              },
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
            );
          }
        );

        if (coords) {
          // Explicit GPS Permission Granted
          await storage.setItem(STORAGE_PERM_KEY, "granted");
          const geo = await reverseGeocodeCoords(coords.latitude, coords.longitude);

          const locData: UserLocationData = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            city: geo.city,
            region: geo.region,
            country: geo.country,
            formattedLocation: geo.formatted,
            source: "gps",
            timestamp: new Date().toISOString(),
            permissionGranted: true,
          };

          this.memoryLocation = locData;
          await storage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(locData));
          return { granted: true, location: locData };
        }
      } catch (err) {
        console.warn("[LocationService] requestLocationPermission error:", err);
      }
    }

    // If GPS was denied or is unavailable: activate Hybrid Coarse IP Fallback
    await storage.setItem(STORAGE_PERM_KEY, "denied");
    const fallback = await fetchCoarseIpLocation();
    if (fallback) {
      this.memoryLocation = fallback;
      await storage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(fallback));
      return { granted: false, location: fallback };
    }

    return { granted: false, location: await this.getStoredLocation() };
  }

  /**
   * Gets current location without blocking UI.
   * Prefers cache; if empty, attempts quick refresh or IP fallback.
   */
  public async getCurrentLocation(forceRefresh = false): Promise<UserLocationData | null> {
    if (!forceRefresh) {
      const cached = await this.getStoredLocation();
      if (cached) return cached;
    }

    if (this.isFetching) {
      return await this.getStoredLocation();
    }

    this.isFetching = true;
    try {
      const perm = await this.checkPermission();
      if (perm.granted) {
        const res = await this.requestLocationPermission();
        if (res.location) return res.location;
      }

      // Hybrid fallback to IP
      const fallback = await fetchCoarseIpLocation();
      if (fallback) {
        this.memoryLocation = fallback;
        await storage.setItem(STORAGE_LOCATION_KEY, JSON.stringify(fallback));
        return fallback;
      }
    } finally {
      this.isFetching = false;
    }

    return await this.getStoredLocation();
  }
}

export const locationService = new LocationService();
