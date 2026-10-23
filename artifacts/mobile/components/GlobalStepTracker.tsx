import React, { useCallback } from "react";
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

/**
 * GLOBAL CONTINUOUS STEP TRACKER
 * 
 * Runs internal device accelerometer & gyroscope at 50ms interval (~20Hz),
 * ensuring continuous, uninterrupted step and calorie tracking throughout the entire app.
 * If user enables wearable extraction, the underlying sensor engine automatically
 * suspends step accumulation to prevent double-counting.
 */
export function GlobalStepTracker() {
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
