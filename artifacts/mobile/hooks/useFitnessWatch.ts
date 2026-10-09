import { useEffect, useState, useCallback } from "react";
import {
  useAnimatedSensor,
  SensorType,
  useFrameCallback,
  runOnJS,
} from "react-native-reanimated";
import {
  fitnessWatchSensor,
  LiveWatchMetrics,
  WorkoutMode,
  WORKOUT_MODE_INFO,
  Motion3D,
} from "@/services/fitnessWatchSensor";

export function useFitnessWatch() {
  const [metrics, setMetrics] = useState<LiveWatchMetrics>(() =>
    fitnessWatchSensor.getSnapshot()
  );

  // Subscribe to the engine's 1-second metric broadcasts
  useEffect(() => {
    const unsub = fitnessWatchSensor.subscribe((latest) => {
      setMetrics(latest);
    });
    return unsub;
  }, []);

  const feedSensorData = useCallback((accel: Motion3D, gyro?: Motion3D, gravity?: Motion3D) => {
    fitnessWatchSensor.handleSensorData(accel, gyro, gravity);
  }, []);

  // Reanimated native hardware sensor hooks
  // Configured at 50Hz (20ms interval) for hardware biomechanical detection
  const accelSensor = useAnimatedSensor(SensorType.ACCELEROMETER, {
    interval: 20,
  });
  const gyroSensor = useAnimatedSensor(SensorType.GYROSCOPE, {
    interval: 20,
  });
  const gravitySensor = useAnimatedSensor(SensorType.GRAVITY, {
    interval: 20,
  });

  // Reanimated UI-thread frame callback feeding real internal sensors
  useFrameCallback(() => {
    "worklet";
    if (accelSensor.isAvailable) {
      const a = accelSensor.sensor.value;
      const g = gyroSensor.isAvailable ? gyroSensor.sensor.value : undefined;
      const gr = gravitySensor.isAvailable ? gravitySensor.sensor.value : undefined;
      runOnJS(feedSensorData)(
        { x: a.x, y: a.y, z: a.z },
        g ? { x: g.x, y: g.y, z: g.z } : undefined,
        gr ? { x: gr.x, y: gr.y, z: gr.z } : undefined
      );
    }
  });

  const startWorkout = useCallback((mode: WorkoutMode) => {
    fitnessWatchSensor.startWorkout(mode);
  }, []);

  const pauseWorkout = useCallback(() => {
    fitnessWatchSensor.pauseWorkout();
  }, []);

  const resumeWorkout = useCallback(() => {
    fitnessWatchSensor.resumeWorkout();
  }, []);

  const stopAndFinishWorkout = useCallback(() => {
    return fitnessWatchSensor.stopAndFinishWorkout();
  }, []);

  return {
    metrics,
    modeInfo: WORKOUT_MODE_INFO[metrics.mode],
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    stopAndFinishWorkout,
    getDailySteps: () => fitnessWatchSensor.getDailySteps(),
  };
}
