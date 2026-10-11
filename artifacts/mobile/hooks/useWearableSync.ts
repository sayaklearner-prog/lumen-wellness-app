import { useState, useEffect, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { 
  wearableSyncService, 
  WearableDevice, 
  WearableTelemetry,
  PRESET_WEARABLE_DEVICES 
} from "@/services/wearableSyncService";

export function useWearableSync() {
  const [connectedDevice, setConnectedDevice] = useState<WearableDevice | null>(
    wearableSyncService.getConnectedDevice()
  );
  const [telemetry, setTelemetry] = useState<WearableTelemetry>(
    wearableSyncService.getLatestTelemetry()
  );
  const [discoveredDevices, setDiscoveredDevices] = useState<WearableDevice[]>(
    wearableSyncService.getPresetDevices()
  );
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  useEffect(() => {
    const unsubTel = wearableSyncService.subscribeTelemetry((newTel) => {
      setTelemetry(newTel);
    });

    const unsubDev = wearableSyncService.subscribeDevice((newDev) => {
      setConnectedDevice(newDev);
    });

    return () => {
      unsubTel();
      unsubDev();
    };
  }, []);

  const scanDevices = useCallback(async () => {
    triggerHaptic();
    setIsScanning(true);
    try {
      const res = await wearableSyncService.scanForDevices();
      if (res.devices) {
        setDiscoveredDevices(res.devices);
      }
    } finally {
      setIsScanning(false);
    }
  }, []);

  const connectDevice = useCallback(async (dev: WearableDevice) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsSyncing(true);
    try {
      const res = await wearableSyncService.connectDevice(dev);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      return res.success;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsSyncing(true);
    try {
      const res = await wearableSyncService.syncNow();
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const disconnectDevice = useCallback(async () => {
    triggerHaptic();
    await wearableSyncService.disconnectDevice();
  }, []);

  return {
    connectedDevice,
    telemetry,
    discoveredDevices,
    isScanning,
    isSyncing,
    scanDevices,
    connectDevice,
    syncNow,
    disconnectDevice,
  };
}
