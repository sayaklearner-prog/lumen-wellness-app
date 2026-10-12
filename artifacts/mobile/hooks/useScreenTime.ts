import { useState, useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { Platform, AppState, AppStateStatus } from "react-native";
import {
  digitalWellbeingService,
  ScreenTimeTelemetry,
  InstalledAppItem,
} from "@/services/digitalWellbeingService";

export function useScreenTime() {
  const [telemetry, setTelemetry] = useState<ScreenTimeTelemetry>(
    digitalWellbeingService.getTelemetry()
  );
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [dndGranted, setDndGranted] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [installedApps, setInstalledApps] = useState<InstalledAppItem[]>([]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  const refreshScreenTime = useCallback(async () => {
    triggerHaptic();
    setIsRefreshing(true);
    try {
      const data = await digitalWellbeingService.fetchTodayScreenTime();
      setTelemetry(data);
      setPermissionGranted(data.permissionGranted);
      return data;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    const usage = await digitalWellbeingService.checkUsagePermission();
    setPermissionGranted(usage.granted);
    const dnd = await digitalWellbeingService.checkDndPermission();
    setDndGranted(dnd.granted);
    return { usage: usage.granted, dnd: dnd.granted };
  }, []);

  const requestUsagePermission = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    await digitalWellbeingService.requestUsagePermission();
    // Re-check after small delay for user return
    setTimeout(() => {
      checkPermissions();
      refreshScreenTime();
    }, 1200);
  }, [checkPermissions, refreshScreenTime]);

  const requestDndPermission = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    await digitalWellbeingService.requestDndPermission();
    setTimeout(() => {
      checkPermissions();
    }, 1200);
  }, [checkPermissions]);

  const loadInstalledApps = useCallback(async () => {
    const apps = await digitalWellbeingService.getInstalledApps();
    setInstalledApps(apps);
    return apps;
  }, []);

  useEffect(() => {
    const unsub = digitalWellbeingService.subscribeTelemetry((newTel) => {
      setTelemetry(newTel);
      setPermissionGranted(newTel.permissionGranted);
    });

    // Check permissions and load screen time initially
    checkPermissions().then(({ usage }) => {
      if (usage) {
        digitalWellbeingService.fetchTodayScreenTime();
      }
    });

    // When app resumes from background (user returning from Android Settings), re-check!
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        checkPermissions().then(({ usage }) => {
          if (usage) {
            digitalWellbeingService.fetchTodayScreenTime();
          }
        });
      }
    };

    const subAppState = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      unsub();
      subAppState.remove();
    };
  }, [checkPermissions]);

  return {
    telemetry,
    permissionGranted,
    dndGranted,
    isRefreshing,
    installedApps,
    refreshScreenTime,
    requestUsagePermission,
    requestDndPermission,
    checkPermissions,
    loadInstalledApps,
  };
}
