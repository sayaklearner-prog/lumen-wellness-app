import { useState, useEffect, useCallback } from "react";
import {
  hydrationService,
  HydrationState,
  HYDRATION_PRESETS,
  BEVERAGE_TYPES,
  HOURLY_HYDRATION_SCHEDULE,
} from "@/services/hydrationService";

export function useHydration(steps = 0, workoutMinutes = 0) {
  const [hydration, setHydration] = useState<HydrationState>(hydrationService.getState());

  useEffect(() => {
    const unsub = hydrationService.subscribe((newState) => {
      setHydration(newState);
    });

    hydrationService.refreshState(steps, workoutMinutes);

    return () => {
      unsub();
    };
  }, [steps, workoutMinutes]);

  const logDrink = useCallback(async (amountMl: number, beverageType = "water") => {
    return await hydrationService.logDrink(amountMl, beverageType);
  }, []);

  const incrementCup = useCallback(async () => {
    return await hydrationService.incrementCup();
  }, []);

  const decrementCup = useCallback(async () => {
    return await hydrationService.decrementCup();
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    return await hydrationService.removeEntry(id);
  }, []);

  const refreshHydration = useCallback(async () => {
    return await hydrationService.refreshState(steps, workoutMinutes);
  }, [steps, workoutMinutes]);

  return {
    hydration,
    logDrink,
    incrementCup,
    decrementCup,
    removeEntry,
    refreshHydration,
    presets: HYDRATION_PRESETS,
    beverageTypes: BEVERAGE_TYPES,
    schedule: HOURLY_HYDRATION_SCHEDULE,
  };
}
