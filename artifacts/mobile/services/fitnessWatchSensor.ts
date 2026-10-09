/**
 * LUMEN FITNESS WATCH SENSOR ENGINE
 * 
 * High-performance biomechanical tracking engine utilizing phone Accelerometer
 * and Gyroscope hardware (via Reanimated sensor worklets, Web DeviceMotion API,
 * and adaptive motion physics).
 * 
 * Features:
 * 1. Pedometer & Stride Tracking (walking/running) with low-pass gravity subtraction
 * 2. Jump Rope Impulse Detection (vertical jerk & peak detection)
 * 3. Strength Rep Counter (eccentric/concentric inflection analysis for Squats/Pushups/Curls)
 * 4. Active Sports & Games Detector (rotational angular rate for swings, punches, agility cuts)
 * 5. Dynamic ACSM MET-based Calorie Burn & Autonomic Heart Rate Zone Modeling
 * 6. Daily Step Accumulation & SQLite Persistence
 */

import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { getKV, setKV } from "./db";

export type WorkoutMode = 
  | "walk" 
  | "run" 
  | "jumprope" 
  | "strength_reps" 
  | "sports_games" 
  | "cycling";

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
  
  // Counters based on active mode
  steps: number;
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
  
  // Cardiovascular & Energy
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
 * Singleton engine maintaining sensor filters, time-series windows,
 * and high-frequency movement analysis.
 */
class FitnessWatchSensorEngine {
  private listeners = new Set<(metrics: LiveWatchMetrics) => void>();
  private timerInterval: any = null;
  private sensorSamplerInterval: any = null;
  private simulationInterval: any = null;

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
  private estimatedHeartRate = 65;
  private currentMet = 1.0;

  // Sensor state
  private rawAccel: Motion3D = { x: 0, y: 9.81, z: 0 };
  private gravityVec: Motion3D = { x: 0, y: 9.81, z: 0 };
  private rawGyro: Motion3D = { x: 0, y: 0, z: 0 };
  private sensorState: "hardware_active" | "simulated" | "standby" = "standby";

  // Step detection DSP buffers
  private lastStepTimestamp = 0;
  private stepIntervalHistory: number[] = [];
  private recentMagSamples: number[] = [];

  // Rep counter state machine
  private repPhase: "rest" | "eccentric" | "inflection" | "concentric" = "rest";
  private repPhaseStartTime = 0;
  private repBaselineVal = 0;

  // Jump rope DSP
  private lastJumpTimestamp = 0;

  // Sports & Game swing DSP
  private lastSwingTimestamp = 0;

  // Daily ambient steps stored in database
  private dailyAmbientSteps = 0;

  constructor() {
    this.initAmbientStepStorage();
    this.initNativeOrWebSensors();
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
    } catch (e) {
      console.warn("Could not load ambient step storage:", e);
    }
  }

  private async persistDailySteps() {
    try {
      const todayKey = `lumen_daily_steps_${new Date().toISOString().slice(0, 10)}`;
      await setKV(todayKey, String(this.dailyAmbientSteps + this.steps));
    } catch {
      // Ignore background persistence hiccups
    }
  }

  public getDailySteps(): number {
    return this.dailyAmbientSteps + this.steps;
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
    const mag = Math.sqrt(
      this.rawAccel.x * this.rawAccel.x +
      this.rawAccel.y * this.rawAccel.y +
      this.rawAccel.z * this.rawAccel.z
    );

    const dynX = this.rawAccel.x - this.gravityVec.x;
    const dynY = this.rawAccel.y - this.gravityVec.y;
    const dynZ = this.rawAccel.z - this.gravityVec.z;
    const dynamicMag = Math.sqrt(dynX * dynX + dynY * dynY + dynZ * dynZ);

    const angularRate = Math.sqrt(
      this.rawGyro.x * this.rawGyro.x +
      this.rawGyro.y * this.rawGyro.y +
      this.rawGyro.z * this.rawGyro.z
    );

    // Heart Rate Zones
    const hr = Math.round(this.estimatedHeartRate);
    const maxHr = this.userBody.maxHr;
    const pct = hr / maxHr;
    let zone: 1 | 2 | 3 | 4 | 5 = 1;
    let zoneLabel = "Zone 1 • Active Recovery";
    let intensity: LiveWatchMetrics["currentIntensity"] = "recovery";

    if (pct >= 0.90) {
      zone = 5;
      zoneLabel = "Zone 5 • Anaerobic Peak";
      intensity = "peak";
    } else if (pct >= 0.80) {
      zone = 4;
      zoneLabel = "Zone 4 • Threshold Power";
      intensity = "anaerobic";
    } else if (pct >= 0.70) {
      zone = 3;
      zoneLabel = "Zone 3 • Aerobic Tempo";
      intensity = "threshold";
    } else if (pct >= 0.60) {
      zone = 2;
      zoneLabel = "Zone 2 • Fat Oxidation";
      intensity = "aerobic";
    }

    // Pace formatting
    let paceMinKm = "--'--\"";
    if (this.currentSpeedKmh > 1.5) {
      const paceDecimal = 60 / this.currentSpeedKmh;
      const mins = Math.floor(paceDecimal);
      const secs = Math.floor((paceDecimal - mins) * 60);
      paceMinKm = `${mins}'${secs.toString().padStart(2, "0")}"`;
    }

    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      mode: this.mode,
      elapsedSeconds: this.elapsedSeconds,
      steps: this.steps,
      reps: this.reps,
      jumps: this.jumps,
      swings: this.swings,
      agilityBursts: this.agilityBursts,
      cadenceSpm: Math.round(this.currentCadenceSpm),
      distanceKm: parseFloat(this.distanceKm.toFixed(2)),
      speedKmh: parseFloat(this.currentSpeedKmh.toFixed(1)),
      paceMinKm,
      activeCalories: Math.round(this.activeCalories),
      estimatedHeartRate: hr,
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
      sensorState: this.sensorState,
    };
  }

  // Initialize hardware sensor hooks (Browser DeviceMotion + Reanimated integration)
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
   * Fed by hardware Reanimated worklet or DeviceMotion at 50Hz (every 20ms)
   */
  public handleSensorData(accel: Motion3D, gyro?: Motion3D) {
    this.rawAccel = accel;
    if (gyro) this.rawGyro = gyro;
    this.sensorState = "hardware_active";

    // 1. Low-Pass Filter (Alpha ~ 0.12) to isolate 1G gravity vector
    const alpha = 0.12;
    this.gravityVec.x = alpha * accel.x + (1 - alpha) * this.gravityVec.x;
    this.gravityVec.y = alpha * accel.y + (1 - alpha) * this.gravityVec.y;
    this.gravityVec.z = alpha * accel.z + (1 - alpha) * this.gravityVec.z;

    // 2. Dynamic linear acceleration without gravity
    const dynX = accel.x - this.gravityVec.x;
    const dynY = accel.y - this.gravityVec.y;
    const dynZ = accel.z - this.gravityVec.z;
    const dynamicMag = Math.sqrt(dynX * dynX + dynY * dynY + dynZ * dynZ);

    const gForce = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z) / 9.81;
    if (gForce > this.peakGForce) {
      this.peakGForce = gForce;
    }

    // Keep rolling magnitude samples
    this.recentMagSamples.push(dynamicMag);
    if (this.recentMagSamples.length > 25) {
      this.recentMagSamples.shift();
    }

    const now = Date.now();

    // 3. Movement DSP depending on active workout mode
    if (this.isActive && !this.isPaused) {
      switch (this.mode) {
        case "walk":
        case "run":
          this.processStepDetection(dynamicMag, now);
          break;
        case "jumprope":
          this.processJumpRopeDetection(dynZ, dynamicMag, now);
          break;
        case "strength_reps":
          this.processRepDetection(dynY, dynamicMag, now);
          break;
        case "sports_games":
          this.processSportsGamesDetection(dynamicMag, now);
          break;
        case "cycling":
          this.processCyclingCadence(dynamicMag, now);
          break;
      }
    } else {
      // When workout is not actively running, count ambient daily steps
      this.processAmbientStepDetection(dynamicMag, now);
    }
  }

  // Step Counter Peak Detection with Refractory Window
  private processStepDetection(dynamicMag: number, now: number) {
    const isRunning = this.mode === "run";
    const threshold = isRunning ? 3.4 : 1.7; // m/s^2 dynamic threshold
    const minStepIntervalMs = isRunning ? 240 : 310; // Max ~240 SPM

    if (dynamicMag > threshold && now - this.lastStepTimestamp > minStepIntervalMs) {
      // Verify gyro isn't pure erratic rotation
      const angRate = Math.sqrt(
        this.rawGyro.x * this.rawGyro.x +
        this.rawGyro.y * this.rawGyro.y +
        this.rawGyro.z * this.rawGyro.z
      );

      if (angRate < 14.0) {
        const deltaMs = now - this.lastStepTimestamp;
        this.lastStepTimestamp = now;
        this.steps++;

        // Stride calculation
        if (deltaMs < 2000) {
          const instantSpm = Math.min(240, Math.max(50, 60000 / deltaMs));
          this.stepIntervalHistory.push(instantSpm);
          if (this.stepIntervalHistory.length > 5) this.stepIntervalHistory.shift();

          const avgSpm =
            this.stepIntervalHistory.reduce((a, b) => a + b, 0) /
            this.stepIntervalHistory.length;
          this.currentCadenceSpm = avgSpm;

          // Biomechanical stride length based on height & cadence
          const heightM = this.userBody.heightCm / 100;
          const strideLengthM = heightM * (0.415 + (isRunning ? 0.0022 : 0.0012) * avgSpm);
          this.distanceKm += strideLengthM / 1000;

          // Speed in km/h
          this.currentSpeedKmh = (strideLengthM * avgSpm * 60) / 1000;
        }

        // Haptic feedback on step milestone
        if (this.steps % 250 === 0 && Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    }
  }

  // Ambient steps counted in background while app is open
  private processAmbientStepDetection(dynamicMag: number, now: number) {
    if (dynamicMag > 1.9 && now - this.lastStepTimestamp > 330) {
      this.lastStepTimestamp = now;
      this.dailyAmbientSteps++;
      if (this.dailyAmbientSteps % 10 === 0) {
        this.persistDailySteps();
      }
    }
  }

  // Jump Rope Detection: Vertical Z-axis impulse and cadence
  private processJumpRopeDetection(dynZ: number, dynamicMag: number, now: number) {
    const jumpThreshold = 3.8;
    const minJumpIntervalMs = 180; // Max ~330 RPM

    if (dynamicMag > jumpThreshold && Math.abs(dynZ) > 2.0 && now - this.lastJumpTimestamp > minJumpIntervalMs) {
      const deltaMs = now - this.lastJumpTimestamp;
      this.lastJumpTimestamp = now;
      this.jumps++;

      if (deltaMs < 1500) {
        const instantRpm = Math.min(300, Math.max(60, 60000 / deltaMs));
        this.currentCadenceSpm = instantRpm;
      }

      // Haptic on jump milestone
      if (this.jumps % 50 === 0 && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }

  // Strength Rep Counter: State machine analyzing harmonic phase oscillations
  private processRepDetection(dynY: number, dynamicMag: number, now: number) {
    const minRepDurationMs = 850;

    switch (this.repPhase) {
      case "rest":
        if (dynY < -1.6 || dynamicMag > 2.2) {
          this.repPhase = "eccentric";
          this.repPhaseStartTime = now;
          this.repBaselineVal = dynY;
        }
        break;

      case "eccentric":
        // Lowering phase: Look for bottom turn inflection
        if (dynY > 0.8 && now - this.repPhaseStartTime > 300) {
          this.repPhase = "concentric";
        }
        break;

      case "concentric":
        // Driving upward phase: Completes repetition
        if (now - this.repPhaseStartTime > minRepDurationMs) {
          this.reps++;
          this.repPhase = "rest";
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

    // High angular velocity (> 4.2 rad/s) = Racket Swing, Boxing Strike, Bat swing
    if (angRate > 4.2 && now - this.lastSwingTimestamp > 450) {
      this.lastSwingTimestamp = now;
      this.swings++;
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    // High linear dynamic acceleration (> 4.8 m/s^2) = Agility Cut, Sprint burst
    if (dynamicMag > 4.8 && now - this.lastStepTimestamp > 500) {
      this.lastStepTimestamp = now;
      this.agilityBursts++;
    }
  }

  // Cycling Cadence
  private processCyclingCadence(dynamicMag: number, now: number) {
    if (dynamicMag > 1.4 && now - this.lastStepTimestamp > 280) {
      const deltaMs = now - this.lastStepTimestamp;
      this.lastStepTimestamp = now;
      if (deltaMs < 2000) {
        const rpm = Math.min(130, Math.max(30, 60000 / deltaMs));
        this.currentCadenceSpm = rpm;
        // Estimated cycling speed (3.5m per pedal rev average)
        this.currentSpeedKmh = (rpm * 3.5 * 60) / 1000;
        this.distanceKm += (this.currentSpeedKmh / 3600) * (deltaMs / 1000);
      }
    }
  }

  /**
   * 1-SECOND METRONOME ENGINE
   * Computes ACSM energy expenditure, physiological heart rate kinetics,
   * cadence decay, and updates telemetry subscribers.
   */
  private startTimerTick() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (!this.isActive || this.isPaused) return;

      this.elapsedSeconds++;

      // Cadence decay if stationary for > 2.5 seconds
      if (Date.now() - this.lastStepTimestamp > 2500 && Date.now() - this.lastJumpTimestamp > 2500) {
        this.currentCadenceSpm = Math.max(0, this.currentCadenceSpm * 0.7);
        this.currentSpeedKmh = Math.max(0, this.currentSpeedKmh * 0.7);
      }

      // Compute dynamic MET
      const baseMet = WORKOUT_MODE_INFO[this.mode].baseMet;
      let cadenceFactor = 1.0;

      if (this.mode === "run" && this.currentCadenceSpm > 150) {
        cadenceFactor = 1.0 + ((this.currentCadenceSpm - 150) / 150) * 0.4;
      } else if (this.mode === "walk" && this.currentCadenceSpm > 110) {
        cadenceFactor = 1.0 + ((this.currentCadenceSpm - 110) / 100) * 0.25;
      }

      this.currentMet = baseMet * cadenceFactor;

      // ACSM Caloric Burn: (MET * 3.5 * kg / 200) / 60 kcal per second
      const burnPerSec = (this.currentMet * 3.5 * this.userBody.weightKg / 200) / 60;
      this.activeCalories += burnPerSec;

      // Dynamic Physiological Heart Rate Lag Simulation
      // HR ramps toward target HR based on current MET exertion
      const targetHr = Math.min(
        this.userBody.maxHr,
        this.userBody.restingHr + (this.currentMet / 12) * (this.userBody.maxHr - this.userBody.restingHr)
      );

      // Smooth autonomic lag (time constant ~ 8s)
      this.estimatedHeartRate += (targetHr - this.estimatedHeartRate) * 0.12;

      this.notify();
    }, 1000);
  }

  // WORKOUT CONTROLS
  public startWorkout(mode: WorkoutMode) {
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
    this.estimatedHeartRate = this.userBody.restingHr + 8;
    this.currentMet = WORKOUT_MODE_INFO[mode].baseMet;

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

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    this.persistDailySteps();
    this.notify();
    return finalMetrics;
  }

  // Simulation mode for Desktop / Web testing or demonstrations
  public toggleSimulationMode() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      this.sensorState = "standby";
      this.notify();
      return false;
    }

    this.sensorState = "simulated";
    let simPhase = 0;

    this.simulationInterval = setInterval(() => {
      simPhase += 0.2;
      const cadencePeriod = this.mode === "run" ? 3.0 : 2.0;
      const verticalPulse = Math.sin(simPhase * cadencePeriod) * 4.2;
      const lateralPulse = Math.cos(simPhase * (cadencePeriod / 2)) * 1.8;

      const simAccel: Motion3D = {
        x: lateralPulse,
        y: 9.81 + Math.abs(verticalPulse),
        z: Math.sin(simPhase * 1.5) * 2.1,
      };

      const simGyro: Motion3D = {
        x: Math.sin(simPhase) * 1.5,
        y: Math.cos(simPhase) * 1.2,
        z: Math.sin(simPhase * 2) * 2.5,
      };

      this.handleSensorData(simAccel, simGyro);
    }, 50); // 20Hz simulation

    this.notify();
    return true;
  }
}

// Export singleton instance
export const fitnessWatchSensor = new FitnessWatchSensorEngine();
