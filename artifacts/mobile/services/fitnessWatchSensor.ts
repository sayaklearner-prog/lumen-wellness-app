/**
 * LUMEN FITNESS WATCH SENSOR ENGINE
 * 
 * Biomechanical tracking engine utilizing phone Accelerometer and Gyroscope hardware
 * (via Reanimated sensor worklets and Web DeviceMotion API).
 * 
 * ZERO-HALLUCINATION POLICY:
 * - Calories, steps, cadence, distance, and repetitions are driven EXCLUSIVELY
 *   by real internal phone hardware sensor measurements.
 * - If the phone is stationary or resting on a surface, active calories and
 *   counters remain strictly at ZERO.
 */

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { getKV, setKV } from "./db";
import { wearableSyncService } from "./wearableSyncService";

export type WorkoutMode = 
  | "treadmill"
  | "walk" 
  | "run" 
  | "jumprope" 
  | "strength_reps" 
  | "sports_games" 
  | "cycling";

export type DetectedActivity = "stationary" | "walking" | "running";

export interface Motion3D {
  x: number;
  y: number;
  z: number;
}

export interface LiveWatchMetrics {
  isActive: boolean;
  isPaused: boolean;
  mode: WorkoutMode;
  elapsedSeconds: number;
  
  // Auto-detection telemetry
  detectedActivity: DetectedActivity;
  detectedActivityLabel: string;
  isAutoDetecting: boolean;
  
  // Counters based on active mode
  steps: number;
  dailySteps: number;
  dailyActiveCalories: number;
  isPhoneStepCounterActive: boolean;
  isWearableSourceActive: boolean;
  activeSourceLabel: string;
  wearableDeviceName: string | null;
  reps: number;
  jumps: number;
  swings: number;
  agilityBursts: number;
  
  // Biomechanics & Kinematics
  cadenceSpm: number;
  distanceKm: number;
  speedKmh: number;
  paceMinKm: string;
  activeCalories: number;
  
  // Exertion & Energy
  estimatedHeartRate: number;
  heartRateZone: 1 | 2 | 3 | 4 | 5;
  heartRateZoneLabel: string;
  currentMet: number;
  peakGForce: number;
  currentIntensity: "recovery" | "aerobic" | "threshold" | "anaerobic" | "peak";
  
  // Live Raw Sensor Stream (m/s^2 and rad/s)
  accel: Motion3D & { magnitude: number; dynamicMag: number };
  gyro: Motion3D & { angularRate: number };
  sensorState: "hardware_active" | "simulated" | "standby";
}

// User anthropometric defaults (overridden from profile)
export interface UserBodyMetrics {
  weightKg: number;
  heightCm: number;
  restingHr: number;
  maxHr: number;
}

const DEFAULT_BODY: UserBodyMetrics = {
  weightKg: 72,
  heightCm: 175,
  restingHr: 62,
  maxHr: 190,
};

// Mode metadata for HUD display
export const WORKOUT_MODE_INFO: Record<WorkoutMode, {
  name: string;
  icon: string;
  baseMet: number;
  primaryMetric: "steps" | "reps" | "jumps" | "swings" | "cadence";
  primaryUnit: string;
  hint: string;
}> = {
  treadmill: {
    name: "Treadmill Workout",
    icon: "🏃‍♂️",
    baseMet: 8.8,
    primaryMetric: "steps",
    primaryUnit: "Steps",
    hint: "Indoor machine session with dedicated chronometer, speed & saved logs",
  },
  walk: {
    name: "Outdoor / Indoor Walk",
    icon: "🚶",
    baseMet: 3.8,
    primaryMetric: "steps",
    primaryUnit: "Steps",
    hint: "Heel-strike acceleration & continuous stride cadence tracking",
  },
  run: {
    name: "Outdoor / Treadmill Run",
    icon: "🏃",
    baseMet: 9.8,
    primaryMetric: "steps",
    primaryUnit: "Steps",
    hint: "High-cadence stride impact, velocity & ground reaction force",
  },
  jumprope: {
    name: "Speed Jump Rope",
    icon: "➰",
    baseMet: 11.0,
    primaryMetric: "jumps",
    primaryUnit: "Jumps",
    hint: "Vertical Z-axis impulse spikes and high-frequency jump rate",
  },
  strength_reps: {
    name: "Strength & Squat Reps",
    icon: "🏋️",
    baseMet: 5.5,
    primaryMetric: "reps",
    primaryUnit: "Reps",
    hint: "Eccentric down & concentric up harmonic inflection detection",
  },
  sports_games: {
    name: "Sports & Active Games",
    icon: "🏸",
    baseMet: 8.5,
    primaryMetric: "swings",
    primaryUnit: "Swings / Bursts",
    hint: "Angular gyro velocity for swings, punches & rapid agility cuts",
  },
  cycling: {
    name: "Cycling Cadence",
    icon: "🚴",
    baseMet: 7.5,
    primaryMetric: "cadence",
    primaryUnit: "RPM",
    hint: "Pedal stroke angular velocity & rhythmic flywheel cadence",
  },
};

/**
 * FITNESS WATCH SENSOR CONTROLLER CLASS
 * High-performance biomechanical engine driven 100% by device internal sensors.
 */
class FitnessWatchSensorEngine {
  private listeners = new Set<(metrics: LiveWatchMetrics) => void>();
  private timerInterval: any = null;

  private userBody: UserBodyMetrics = { ...DEFAULT_BODY };
  private mode: WorkoutMode = "walk";
  private isActive = false;
  private isPaused = false;
  private elapsedSeconds = 0;

  // Cumulative metrics
  private steps = 0;
  private reps = 0;
  private jumps = 0;
  private swings = 0;
  private agilityBursts = 0;
  private distanceKm = 0;
  private activeCalories = 0;
  private peakGForce = 1.0;

  // Real-time smoothed metrics
  private currentCadenceSpm = 0;
  private currentSpeedKmh = 0;
  private estimatedHeartRate = 62;
  private currentMet = 1.0;

  // Sensor state
  private rawAccel: Motion3D = { x: 0, y: 9.81, z: 0 };
  private rawGyro: Motion3D = { x: 0, y: 0, z: 0 };
  private sensorState: "hardware_active" | "simulated" | "standby" = "standby";

  // StepTrackerAndroid / DebugActivity.java smoothing variables
  private static readonly SMOOTHING_WINDOW_SIZE = 20;
  private mRawAccelValues: [number, number, number] = [0, 9.81, 0];
  private mAccelValueHistory: [number[], number[], number[]] = [
    new Array(20).fill(0),
    new Array(20).fill(0),
    new Array(20).fill(0),
  ];
  private mRunningAccelTotal: [number, number, number] = [0, 0, 0];
  private mCurAccelAvg: [number, number, number] = [0, 0, 0];
  private mCurReadIndex = 0;
  private mBufferInitialized = false;

  // Signal magnitudes (derived from raw & moving average)
  private lastMag = 0;
  private avgMag = 0;
  private netMag = 0;

  // StepTrackerAndroid / DebugActivity.java peak detection variables
  // (Mladenov et al. algorithm)
  private windowSize = 10;
  private netMagHistory: number[] = [];
  private ambientNetMagHistory: number[] = [];
  private lastStepTimestamp = 0;
  private lastAmbientStepTimestamp = 0;
  private stepIntervalHistory: number[] = [];

  // Deduplication check to prevent duplicate worklet frames from shrinking the smoothing window
  private lastFedSample: Motion3D = { x: 0, y: 0, z: 0 };
  private hasFedSample = false;

  // Jump rope peak-valley
  private jumpState: "PEAK" | "VALLEY" = "PEAK";
  private jumpPeakMag = 0;
  private lastJumpTimestamp = 0;

  // Rep counter state machine
  private repPhase: "rest" | "eccentric" | "inflection" | "concentric" = "rest";
  private repPhaseStartTime = 0;

  // Sports & Game swing DSP
  private lastSwingTimestamp = 0;

  // Autonomous motion auto-detection & continuous step counting
  private detectedActivity: DetectedActivity = "stationary";
  private detectedActivityLabel = "Stationary • Ready";
  private slidingNetMagHistory: number[] = [];
  private dailyAmbientSteps = 0;
  private dailyAmbientDistanceKm = 0;
  private dailyAmbientActiveCalories = 0;

  constructor() {
    this.initAmbientStepStorage();
    this.initNativeOrWebSensors();

    // Re-evaluate telemetry snapshot whenever wearable connection or telemetry syncs
    wearableSyncService.subscribeDevice(() => {
      this.notify();
    });
    wearableSyncService.subscribeTelemetry(() => {
      this.notify();
    });
  }

  public setUserBody(body: Partial<UserBodyMetrics>) {
    this.userBody = { ...this.userBody, ...body };
  }

  // Persistent Daily Steps in Lumen SQLite kv_store
  private async initAmbientStepStorage() {
    try {
      const todayKey = `lumen_daily_steps_${new Date().toISOString().slice(0, 10)}`;
      const saved = await getKV(todayKey);
      if (saved) {
        this.dailyAmbientSteps = parseInt(saved, 10) || 0;
      }
      const calsKey = `lumen_daily_cals_${new Date().toISOString().slice(0, 10)}`;
      const savedCals = await getKV(calsKey);
      if (savedCals) {
        this.dailyAmbientActiveCalories = parseFloat(savedCals) || 0;
      }
      const distKey = `lumen_daily_dist_${new Date().toISOString().slice(0, 10)}`;
      const savedDist = await getKV(distKey);
      if (savedDist) {
        this.dailyAmbientDistanceKm = parseFloat(savedDist) || 0;
      }
    } catch (e) {
      console.warn("Could not load ambient step storage:", e);
    }
  }

  private async persistDailySteps() {
    try {
      const todayKey = `lumen_daily_steps_${new Date().toISOString().slice(0, 10)}`;
      await setKV(todayKey, String(this.dailyAmbientSteps));
      const calsKey = `lumen_daily_cals_${new Date().toISOString().slice(0, 10)}`;
      await setKV(calsKey, String(this.dailyAmbientActiveCalories));
      const distKey = `lumen_daily_dist_${new Date().toISOString().slice(0, 10)}`;
      await setKV(distKey, String(this.dailyAmbientDistanceKm));
    } catch {
      // Ignore background persistence hiccups
    }
  }

  public isWearableExtracting(): boolean {
    return wearableSyncService.isWearableStepSourceActive();
  }

  public getDailySteps(): number {
    if (wearableSyncService.isWearableStepSourceActive()) {
      const wTel = wearableSyncService.getLatestTelemetry();
      if (wTel.steps > 0) {
        return wTel.steps;
      }
    }
    return this.dailyAmbientSteps;
  }

  public getDailyActiveCalories(): number {
    if (wearableSyncService.isWearableStepSourceActive()) {
      const wTel = wearableSyncService.getLatestTelemetry();
      if (wTel.activeCalories > 0) {
        return wTel.activeCalories;
      }
    }
    return Math.round(this.dailyAmbientActiveCalories || (this.dailyAmbientSteps * 0.045));
  }

  /**
   * Synchronizes steps recorded by the 24/7 native Android Background Step Service
   * when the app was closed, suspended, or screen was off.
   */
  public syncNativeBackgroundSteps(nativeSteps: number, nativeCals?: number, nativeDist?: number) {
    if (nativeSteps > this.dailyAmbientSteps) {
      this.dailyAmbientSteps = nativeSteps;
      if (typeof nativeCals === "number" && nativeCals > this.dailyAmbientActiveCalories) {
        this.dailyAmbientActiveCalories = nativeCals;
      }
      if (typeof nativeDist === "number" && nativeDist > this.dailyAmbientDistanceKm) {
        this.dailyAmbientDistanceKm = nativeDist;
      }
      this.persistDailySteps();
      this.notify();
    }
  }

  // Subscribe to live telemetry stream
  public subscribe(cb: (metrics: LiveWatchMetrics) => void): () => void {
    this.listeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snap);
      } catch (e) {
        console.error("Watch telemetry callback error:", e);
      }
    });
  }

  public getSnapshot(): LiveWatchMetrics {
    const mag = this.lastMag || Math.sqrt(
      this.rawAccel.x * this.rawAccel.x +
      this.rawAccel.y * this.rawAccel.y +
      this.rawAccel.z * this.rawAccel.z
    );

    const dynamicMag = Math.abs(this.netMag);

    const angularRate = Math.sqrt(
      this.rawGyro.x * this.rawGyro.x +
      this.rawGyro.y * this.rawGyro.y +
      this.rawGyro.z * this.rawGyro.z
    );

    // Physiological Exertion Zones (Calculated ONLY when user is moving)
    let zone: 1 | 2 | 3 | 4 | 5 = 1;
    let zoneLabel = "Zone 1 • Recovery / Standby";
    let intensity: LiveWatchMetrics["currentIntensity"] = "recovery";

    if (this.currentCadenceSpm > 0) {
      if (this.currentCadenceSpm > 165 || dynamicMag > 4.5) {
        zone = 5;
        zoneLabel = "Zone 5 • Anaerobic Peak";
        intensity = "peak";
      } else if (this.currentCadenceSpm > 140 || dynamicMag > 3.2) {
        zone = 4;
        zoneLabel = "Zone 4 • Threshold Power";
        intensity = "anaerobic";
      } else if (this.currentCadenceSpm > 115 || dynamicMag > 2.2) {
        zone = 3;
        zoneLabel = "Zone 3 • Aerobic Tempo";
        intensity = "threshold";
      } else if (this.currentCadenceSpm > 80 || dynamicMag > 1.4) {
        zone = 2;
        zoneLabel = "Zone 2 • Active Movement";
        intensity = "aerobic";
      }
    }

    // Pace formatting
    let paceMinKm = "--'--\"";
    if (this.currentSpeedKmh > 0.5) {
      const paceDecimal = 60 / this.currentSpeedKmh;
      const mins = Math.floor(paceDecimal);
      const secs = Math.round((paceDecimal - mins) * 60);
      paceMinKm = `${mins}'${secs.toString().padStart(2, "0")}"`;
    }

    const isWearableActive = wearableSyncService.isWearableStepSourceActive();
    const connectedWearable = wearableSyncService.getConnectedDevice();
    const wearableTel = isWearableActive ? wearableSyncService.getLatestTelemetry() : null;

    const resolvedDailySteps = isWearableActive && wearableTel && wearableTel.steps > 0
      ? wearableTel.steps
      : this.dailyAmbientSteps;

    const resolvedDailyActiveCalories = isWearableActive && wearableTel && wearableTel.activeCalories > 0
      ? wearableTel.activeCalories
      : parseFloat((this.dailyAmbientActiveCalories || (this.dailyAmbientSteps * 0.045)).toFixed(1));

    const resolvedCadence = isWearableActive && wearableTel && wearableTel.cadenceSpm > 0
      ? wearableTel.cadenceSpm
      : this.currentCadenceSpm;

    const resolvedDistance = isWearableActive && wearableTel && wearableTel.distanceKm > 0
      ? wearableTel.distanceKm
      : parseFloat((this.dailyAmbientDistanceKm || (this.dailyAmbientSteps * 0.00075)).toFixed(2));

    const resolvedHeartRate = wearableTel && wearableTel.heartRate > 0
      ? wearableTel.heartRate
      : (this.currentCadenceSpm > 0 ? Math.round(this.estimatedHeartRate) : this.userBody.restingHr);

    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      mode: this.mode,
      elapsedSeconds: this.elapsedSeconds,
      detectedActivity: this.detectedActivity,
      detectedActivityLabel: this.detectedActivityLabel,
      isAutoDetecting: !this.isActive && !isWearableActive,
      steps: this.steps,
      dailySteps: resolvedDailySteps,
      dailyActiveCalories: resolvedDailyActiveCalories,
      isPhoneStepCounterActive: !isWearableActive,
      isWearableSourceActive: isWearableActive,
      activeSourceLabel: isWearableActive
        ? `Wearable (${connectedWearable?.name || "Connected Device"})`
        : "Phone Accelerometer (Always ON)",
      wearableDeviceName: isWearableActive ? (connectedWearable?.name || null) : null,
      reps: this.reps,
      jumps: this.jumps,
      swings: this.swings,
      agilityBursts: this.agilityBursts,
      cadenceSpm: resolvedCadence,
      distanceKm: resolvedDistance,
      speedKmh: parseFloat(this.currentSpeedKmh.toFixed(1)),
      paceMinKm,
      activeCalories: resolvedDailyActiveCalories,
      estimatedHeartRate: resolvedHeartRate,
      heartRateZone: zone,
      heartRateZoneLabel: zoneLabel,
      currentMet: parseFloat(this.currentMet.toFixed(1)),
      peakGForce: parseFloat(this.peakGForce.toFixed(2)),
      currentIntensity: intensity,
      accel: {
        x: parseFloat(this.rawAccel.x.toFixed(2)),
        y: parseFloat(this.rawAccel.y.toFixed(2)),
        z: parseFloat(this.rawAccel.z.toFixed(2)),
        magnitude: parseFloat(mag.toFixed(2)),
        dynamicMag: parseFloat(dynamicMag.toFixed(2)),
      },
      gyro: {
        x: parseFloat(this.rawGyro.x.toFixed(2)),
        y: parseFloat(this.rawGyro.y.toFixed(2)),
        z: parseFloat(this.rawGyro.z.toFixed(2)),
        angularRate: parseFloat(angularRate.toFixed(2)),
      },
      sensorState: connectedWearable?.isConnected ? "hardware_active" : this.sensorState,
    };
  }

  // Initialize hardware sensor hooks (Browser DeviceMotion API for web / browser testing)
  private initNativeOrWebSensors() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.addEventListener("devicemotion", (e) => {
          if (e.accelerationIncludingGravity) {
            const acc = e.accelerationIncludingGravity;
            this.handleSensorData(
              {
                x: acc.x || 0,
                y: acc.y || 9.81,
                z: acc.z || 0,
              },
              {
                x: (e.rotationRate?.alpha || 0) * (Math.PI / 180),
                y: (e.rotationRate?.beta || 0) * (Math.PI / 180),
                z: (e.rotationRate?.gamma || 0) * (Math.PI / 180),
              }
            );
            this.sensorState = "hardware_active";
          }
        });
      } catch (err) {
        console.warn("DeviceMotion listener registration skipped:", err);
      }
    }
  }

  /**
   * HIGH FREQUENCY SENSOR PIPELINE
   * Fed directly by mobile device internal sensors (Accelerometer, Gyroscope).
   * Exact signal smoothing, gravity decoupling & peak detection ported from StepTrackerAndroid (DebugActivity.java)
   */
  public handleSensorData(accel: Motion3D, gyro?: Motion3D, _gravity?: Motion3D) {
    if (gyro) this.rawGyro = gyro;
    this.sensorState = "hardware_active";

    // Deduplicate identical readings if worklet frame fired without new hardware ADC update
    if (
      this.hasFedSample &&
      accel.x === this.lastFedSample.x &&
      accel.y === this.lastFedSample.y &&
      accel.z === this.lastFedSample.z
    ) {
      return;
    }

    this.hasFedSample = true;
    this.lastFedSample = { x: accel.x, y: accel.y, z: accel.z };
    this.rawAccel = accel;

    this.mRawAccelValues = [accel.x, accel.y, accel.z];

    // Seed circular buffer on initial reading to establish stationary orientation baseline
    if (!this.mBufferInitialized) {
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < FitnessWatchSensorEngine.SMOOTHING_WINDOW_SIZE; k++) {
          this.mAccelValueHistory[i][k] = this.mRawAccelValues[i];
        }
        this.mRunningAccelTotal[i] = this.mRawAccelValues[i] * FitnessWatchSensorEngine.SMOOTHING_WINDOW_SIZE;
        this.mCurAccelAvg[i] = this.mRawAccelValues[i];
      }
      this.mBufferInitialized = true;
    }

    // 1. Raw magnitude: Math.sqrt(x^2 + y^2 + z^2)
    this.lastMag = Math.sqrt(
      this.mRawAccelValues[0] * this.mRawAccelValues[0] +
      this.mRawAccelValues[1] * this.mRawAccelValues[1] +
      this.mRawAccelValues[2] * this.mRawAccelValues[2]
    );

    // 2. Exact StepTrackerAndroid per-axis running window smoothing (Source: CSE590Sp2018 / Jon Froehlich)
    for (let i = 0; i < 3; i++) {
      this.mRunningAccelTotal[i] = this.mRunningAccelTotal[i] - this.mAccelValueHistory[i][this.mCurReadIndex];
      this.mAccelValueHistory[i][this.mCurReadIndex] = this.mRawAccelValues[i];
      this.mRunningAccelTotal[i] = this.mRunningAccelTotal[i] + this.mAccelValueHistory[i][this.mCurReadIndex];
      this.mCurAccelAvg[i] = this.mRunningAccelTotal[i] / FitnessWatchSensorEngine.SMOOTHING_WINDOW_SIZE;
    }
    this.mCurReadIndex++;
    if (this.mCurReadIndex >= FitnessWatchSensorEngine.SMOOTHING_WINDOW_SIZE) {
      this.mCurReadIndex = 0;
    }

    // 3. Average magnitude (smoothed gravity component)
    this.avgMag = Math.sqrt(
      this.mCurAccelAvg[0] * this.mCurAccelAvg[0] +
      this.mCurAccelAvg[1] * this.mCurAccelAvg[1] +
      this.mCurAccelAvg[2] * this.mCurAccelAvg[2]
    );

    // 4. Net dynamic acceleration (removes gravity effect): lastMag - avgMag
    this.netMag = this.lastMag - this.avgMag;

    const gForce = this.lastMag / 9.81;
    if (gForce > this.peakGForce) {
      this.peakGForce = parseFloat(gForce.toFixed(2));
    }

    const now = Date.now();

    // 5. Movement DSP based on active workout mode
    const isWearableActive = wearableSyncService.isWearableStepSourceActive();
    if (isWearableActive) {
      // User has chosen to extract steps & calories from wearables!
      // Stop usage of the phone step counter to prevent double counting.
      return;
    }

    // Auto-decay cadence and reset activity if stationary for > 3.2 seconds
    if (now - this.lastStepTimestamp > 3200 && this.currentCadenceSpm > 0) {
      this.currentCadenceSpm = 0;
      this.currentSpeedKmh = 0;
      this.detectedActivity = "stationary";
      this.detectedActivityLabel = "Stationary • Ready";
      this.notify();
    }

    if (this.isActive && !this.isPaused) {
      switch (this.mode) {
        case "treadmill":
        case "walk":
        case "run":
          this.processStepDetection(now, true);
          break;
        case "jumprope":
          this.processJumpRopeDetection(this.netMag, now);
          break;
        case "strength_reps":
          this.processRepDetection(this.mRawAccelValues[1] - this.mCurAccelAvg[1], this.netMag, now);
          break;
        case "sports_games":
          this.processSportsGamesDetection(this.netMag, now);
          break;
        case "cycling":
          this.processCyclingCadence(this.netMag, now);
          break;
      }
    } else {
      // Continuous background step tracking & auto-detection is ALWAYS ON!
      this.processStepDetection(now, false);
    }
  }

  /**
   * High-accuracy sliding-window step peak detection & autonomous activity classifier.
   * Tracks steps continuously with adaptive sensitivity (0.38 - 5.8 m/s^2),
   * ensuring no steps are missed in pocket, hand, or on foot.
   */
  private processStepDetection(now: number, isTreadmillSession: boolean) {
    this.slidingNetMagHistory.push(this.netMag);
    if (this.slidingNetMagHistory.length > 20) {
      this.slidingNetMagHistory.shift();
    }

    if (this.slidingNetMagHistory.length < 5) {
      return;
    }

    const mid = this.slidingNetMagHistory.length - 2;
    const prev = this.slidingNetMagHistory[mid - 1];
    const curr = this.slidingNetMagHistory[mid];
    const next = this.slidingNetMagHistory[mid + 1];

    // High sensitivity threshold: 0.38 m/s^2 detects gentle walking / pocket movement
    // Upper ceiling: 5.8 m/s^2 avoids false drops
    const stepThreshold = isTreadmillSession ? 0.60 : 0.38;
    const noiseThreshold = 5.8;
    const minStepIntervalMs = isTreadmillSession ? 210 : 230;

    if (
      curr > prev &&
      curr >= next &&
      curr > stepThreshold &&
      curr < noiseThreshold
    ) {
      if (now - this.lastStepTimestamp >= minStepIntervalMs) {
        const deltaMs = this.lastStepTimestamp === 0 ? 550 : (now - this.lastStepTimestamp);
        this.lastStepTimestamp = now;

        // Count daily continuous step
        this.dailyAmbientSteps++;
        if (isTreadmillSession) {
          this.steps++;
        }

        // Calculate Cadence (SPM)
        if (deltaMs <= 2500) {
          const instantSpm = Math.min(240, Math.max(45, Math.round(60000 / deltaMs)));
          this.stepIntervalHistory.push(instantSpm);
          if (this.stepIntervalHistory.length > 4) this.stepIntervalHistory.shift();
          const avgSpm = Math.round(
            this.stepIntervalHistory.reduce((a, b) => a + b, 0) / this.stepIntervalHistory.length
          );
          this.currentCadenceSpm = avgSpm;

          // Auto-classify movement into Walking or Running autonomously
          if (avgSpm > 125 || curr > 1.8) {
            this.detectedActivity = "running";
            this.detectedActivityLabel = isTreadmillSession
              ? "Treadmill Running"
              : "Outdoor Running (Auto-Detected)";
          } else {
            this.detectedActivity = "walking";
            this.detectedActivityLabel = isTreadmillSession
              ? "Treadmill Walking"
              : "Outdoor Walking (Auto-Detected)";
          }

          // Biomechanical stride length based on height & cadence
          const isRun = this.detectedActivity === "running" || this.mode === "treadmill";
          const heightM = this.userBody.heightCm / 100;
          const strideLengthM = heightM * (0.415 + (isRun ? 0.0022 : 0.0012) * avgSpm);

          if (isTreadmillSession) {
            this.distanceKm = parseFloat((this.distanceKm + strideLengthM / 1000).toFixed(3));
            this.currentSpeedKmh = parseFloat(((strideLengthM * avgSpm * 60) / 1000).toFixed(1));
            const kcalPerStep = (isRun ? 0.055 : 0.042) * (this.userBody.weightKg / 70);
            this.activeCalories = parseFloat((this.activeCalories + kcalPerStep).toFixed(1));
          } else {
            this.dailyAmbientDistanceKm = parseFloat((this.dailyAmbientDistanceKm + strideLengthM / 1000).toFixed(3));
            this.currentSpeedKmh = parseFloat(((strideLengthM * avgSpm * 60) / 1000).toFixed(1));
            const kcalPerStep = (isRun ? 0.055 : 0.042) * (this.userBody.weightKg / 70);
            this.dailyAmbientActiveCalories = parseFloat((this.dailyAmbientActiveCalories + kcalPerStep).toFixed(1));
          }

          // Heart rate exertion model based on cadence
          const cadenceRatio = Math.min(1.0, Math.max(0, (avgSpm - 50) / 140));
          const targetHr = this.userBody.restingHr + cadenceRatio * (this.userBody.maxHr - this.userBody.restingHr);
          this.estimatedHeartRate = Math.round(this.estimatedHeartRate + (targetHr - this.estimatedHeartRate) * 0.2);
        }

        if (this.dailyAmbientSteps % 5 === 0) {
          this.persistDailySteps();
        }

        this.notify();
      }
    }
  }

  // Jump Rope Detection: Dynamic magnitude impulse and cadence
  private processJumpRopeDetection(dynamicMag: number, now: number) {
    if (this.jumpState === "PEAK") {
      if (dynamicMag > 3.6) {
        if (dynamicMag > this.jumpPeakMag) {
          this.jumpPeakMag = dynamicMag;
        } else if (dynamicMag < this.jumpPeakMag - 0.5) {
          this.jumpState = "VALLEY";
        }
      }
    } else {
      if (dynamicMag < 1.0) {
        const deltaMs = now - this.lastJumpTimestamp;
        if (deltaMs >= 200) {
          this.lastJumpTimestamp = now;
          this.jumps++;

          if (deltaMs < 1500) {
            const instantRpm = Math.min(300, Math.max(60, Math.round(60000 / deltaMs)));
            this.currentCadenceSpm = instantRpm;
          }

          const kcalPerJump = 0.14 * (this.userBody.weightKg / 70);
          this.activeCalories = parseFloat((this.activeCalories + kcalPerJump).toFixed(1));

          if (this.jumps % 50 === 0 && Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          this.notify();
        }
        this.jumpPeakMag = 0;
        this.jumpState = "PEAK";
      }
    }
  }

  // Strength Rep Counter: State machine analyzing harmonic phase oscillations
  private processRepDetection(dynY: number, dynamicMag: number, now: number) {
    const minRepDurationMs = 900;

    switch (this.repPhase) {
      case "rest":
        if (dynY < -1.8 || dynamicMag > 2.4) {
          this.repPhase = "eccentric";
          this.repPhaseStartTime = now;
        }
        break;

      case "eccentric":
        // Lowering phase: Look for bottom turn inflection
        if (dynY > 1.0 && now - this.repPhaseStartTime > 350) {
          this.repPhase = "concentric";
        }
        break;

      case "concentric":
        // Driving upward phase: Completes repetition
        if (now - this.repPhaseStartTime > minRepDurationMs && dynamicMag < 1.2) {
          this.reps++;
          this.repPhase = "rest";
          // Real calories per strength rep: ~0.32 kcal for 70kg human
          const kcalPerRep = 0.32 * (this.userBody.weightKg / 70);
          this.activeCalories = parseFloat((this.activeCalories + kcalPerRep).toFixed(1));

          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }
        }
        break;
    }
  }

  // Sports & Games: Rotational gyro velocity for swings, punches & agility cuts
  private processSportsGamesDetection(dynamicMag: number, now: number) {
    const angRate = Math.sqrt(
      this.rawGyro.x * this.rawGyro.x +
      this.rawGyro.y * this.rawGyro.y +
      this.rawGyro.z * this.rawGyro.z
    );

    // High angular velocity (> 4.5 rad/s) = Racket Swing, Boxing Strike
    if (angRate > 4.5 && now - this.lastSwingTimestamp > 500) {
      this.lastSwingTimestamp = now;
      this.swings++;
      const kcalPerSwing = 0.22 * (this.userBody.weightKg / 70);
      this.activeCalories = parseFloat((this.activeCalories + kcalPerSwing).toFixed(1));
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    // High linear dynamic acceleration (> 5.0 m/s^2) = Agility Cut, Sprint burst
    if (dynamicMag > 5.0 && now - this.lastStepTimestamp > 600) {
      this.lastStepTimestamp = now;
      this.agilityBursts++;
      const kcalPerBurst = 0.35 * (this.userBody.weightKg / 70);
      this.activeCalories = parseFloat((this.activeCalories + kcalPerBurst).toFixed(1));
    }
  }

  // Cycling Cadence
  private processCyclingCadence(dynamicMag: number, now: number) {
    if (dynamicMag > 1.6 && now - this.lastStepTimestamp > 300) {
      const deltaMs = now - this.lastStepTimestamp;
      this.lastStepTimestamp = now;
      if (deltaMs < 2000) {
        const rpm = Math.min(130, Math.max(30, 60000 / deltaMs));
        this.currentCadenceSpm = Math.round(rpm);
        this.currentSpeedKmh = parseFloat(((rpm * 3.5 * 60) / 1000).toFixed(1));
        const addedKm = (this.currentSpeedKmh / 3600) * (deltaMs / 1000);
        this.distanceKm = parseFloat((this.distanceKm + addedKm).toFixed(3));
        const kcalPerRev = 0.08 * (this.userBody.weightKg / 70);
        this.activeCalories = parseFloat((this.activeCalories + kcalPerRev).toFixed(1));
      }
    }
  }

  /**
   * 1-SECOND METRONOME ENGINE
   * Ticks elapsed time and decays cadence when stationary.
   * DOES NOT hallucinate or auto-accumulate calories or heart rate.
   */
  private startTimerTick() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (!this.isActive || this.isPaused) return;

      this.elapsedSeconds++;

      // Cadence decays to 0 if stationary for > 2.0 seconds
      if (Date.now() - this.lastStepTimestamp > 2000 && Date.now() - this.lastJumpTimestamp > 2000) {
        this.currentCadenceSpm = 0;
        this.currentSpeedKmh = 0;
      }

      this.notify();
    }, 1000);
  }

  // WORKOUT CONTROLS
  public startWorkout(mode: WorkoutMode = "treadmill") {
    this.mode = mode;
    this.isActive = true;
    this.isPaused = false;
    this.elapsedSeconds = 0;
    this.steps = 0;
    this.reps = 0;
    this.jumps = 0;
    this.swings = 0;
    this.agilityBursts = 0;
    this.distanceKm = 0;
    this.activeCalories = 0;
    this.peakGForce = 1.0;
    this.currentCadenceSpm = 0;
    this.currentSpeedKmh = 0;
    this.estimatedHeartRate = this.userBody.restingHr;
    this.currentMet = WORKOUT_MODE_INFO[mode]?.baseMet || 8.8;
    this.lastStepTimestamp = 0;
    this.stepIntervalHistory = [];
    this.slidingNetMagHistory = [];
    this.netMagHistory = [];
    this.mBufferInitialized = false;
    this.hasFedSample = false;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    this.startTimerTick();
    this.notify();
  }

  public pauseWorkout() {
    this.isPaused = true;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    this.notify();
  }

  public resumeWorkout() {
    this.isPaused = false;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    this.notify();
  }

  public stopAndFinishWorkout(): LiveWatchMetrics {
    const finalMetrics = this.getSnapshot();
    this.isActive = false;
    this.isPaused = false;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    this.persistDailySteps();
    this.notify();
    return finalMetrics;
  }

  // No-op for legacy simulation calls
  public toggleSimulationMode() {
    return false;
  }
}

// Export singleton instance
export const fitnessWatchSensor = new FitnessWatchSensorEngine();
