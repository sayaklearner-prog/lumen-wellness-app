import React, { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import {
  useAnimatedSensor,
  SensorType,
  useFrameCallback,
  runOnJS,
} from "react-native-reanimated";
import {
  fitnessWatchSensor,
  Motion3D,
} from "@/services/fitnessWatchSensor";
import { nativeStepCounter } from "@/services/nativeStepCounter";

/**
 * GLOBAL CONTINUOUS STEP TRACKER
 * 
 * 1. Launches 24/7 Native Background Step Counter Foreground Service (Android hardware pedometer)
 *    so steps continue counting without stopping when the app is closed, minimized, or screen locked.
 * 2. Runs internal device accelerometer & gyroscope worklet at 50ms interval (~20Hz)
 *    for live interactive UI animations while app is open.
 * 3. Automatically suspends phone sensors if user chooses to extract steps from smart wearables.
 */
export function GlobalStepTracker() {
  // Initialize 24/7 background native pedometer service
  useEffect(() => {
    nativeStepCounter.init();
  }, []);

  const feedSensorData = useCallback((accel: Motion3D, gyro?: Motion3D) => {
    fitnessWatchSensor.handleSensorData(accel, gyro);
  }, []);

  // Native Reanimated hardware sensor hooks
  const accelSensor = useAnimatedSensor(SensorType.ACCELEROMETER, {
    interval: 50,
  });
  const gyroSensor = useAnimatedSensor(SensorType.GYROSCOPE, {
    interval: 50,
  });

  // UI-thread worklet callback feeding real accelerometer readings
  useFrameCallback(() => {
    "worklet";
    if (accelSensor.isAvailable) {
      const a = accelSensor.sensor.value;
      const g = gyroSensor.isAvailable ? gyroSensor.sensor.value : undefined;
      runOnJS(feedSensorData)(
        { x: a.x, y: a.y, z: a.z },
        g ? { x: g.x, y: g.y, z: g.z } : undefined
      );
    }
  });

  return null;
}
