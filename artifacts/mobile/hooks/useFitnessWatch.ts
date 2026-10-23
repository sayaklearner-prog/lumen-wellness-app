import { useEffect, useState, useCallback } from "react";
import {
  fitnessWatchSensor,
  LiveWatchMetrics,
  WorkoutMode,
  WORKOUT_MODE_INFO,
} from "@/services/fitnessWatchSensor";

export function useFitnessWatch() {
  const [metrics, setMetrics] = useState<LiveWatchMetrics>(() =>
    fitnessWatchSensor.getSnapshot()
  );

  // Subscribe to the engine's real-time metric broadcasts
  useEffect(() => {
    const unsub = fitnessWatchSensor.subscribe((latest) => {
      setMetrics(latest);
    });
    return unsub;
  }, []);

  const startWorkout = useCallback((mode: WorkoutMode = "treadmill") => {
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
    modeInfo: WORKOUT_MODE_INFO[metrics.mode] || WORKOUT_MODE_INFO.treadmill,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    stopAndFinishWorkout,
    getDailySteps: () => fitnessWatchSensor.getDailySteps(),
  };
}
