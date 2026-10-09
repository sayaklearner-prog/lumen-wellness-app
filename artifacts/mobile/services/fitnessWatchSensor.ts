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
  private gravityVec: Motion3D = { x: 0, y: 9.81, z: 0 };
  private rawGyro: Motion3D = { x: 0, y: 0, z: 0 };
  private sensorState: "hardware_active" | "simulated" | "standby" = "standby";
  private hasInitializedGravity = false;

  // Step detection Peak-and-Valley State Machine
  private stepDetectorState: "LOOKING_FOR_PEAK" | "LOOKING_FOR_VALLEY" = "LOOKING_FOR_PEAK";
  private currentStepPeakMag = 0;
  private lastStepTimestamp = 0;
  private stepIntervalHistory: number[] = [];

  // Jump rope peak-valley
  private jumpState: "PEAK" | "VALLEY" = "PEAK";
  private jumpPeakMag = 0;
  private lastJumpTimestamp = 0;

  // Rep counter state machine
  private repPhase: "rest" | "eccentric" | "inflection" | "concentric" = "rest";
  private repPhaseStartTime = 0;

  // Sports & Game swing DSP
  private lastSwingTimestamp = 0;

  // Ambient steps counted when workout is not active
  private dailyAmbientSteps = 0;
  private ambientPeakMag = 0;
  private ambientState: "PEAK" | "VALLEY" = "PEAK";

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

    // Physiological Exertion Zones (Calculated ONLY when user is moving)
    let zone: 1 | 2 | 3 | 4 | 5 = 1;
    let zoneLabel = "Zone 1 • Recovery / Standby";
    let intensity: LiveWatchMetrics["currentIntensity"] = "recovery";

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

    // Pace formatting
    let paceMinKm = "--'--\"";
    if (this.currentSpeedKmh > 0.5) {
      const paceDecimal = 60 / this.currentSpeedKmh;
      const mins = Math.floor(paceDecimal);
      const secs = Math.round((paceDecimal - mins) * 60);
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
      cadenceSpm: this.currentCadenceSpm,
      distanceKm: parseFloat(this.distanceKm.toFixed(2)),
      speedKmh: parseFloat(this.currentSpeedKmh.toFixed(1)),
      paceMinKm,
      activeCalories: parseFloat(this.activeCalories.toFixed(1)),
      estimatedHeartRate: this.currentCadenceSpm > 0 ? Math.round(this.estimatedHeartRate) : this.userBody.restingHr,
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
   * Fed directly by mobile device internal sensors (Accelerometer, Gyroscope, Gravity)
   */
  public handleSensorData(accel: Motion3D, gyro?: Motion3D, gravity?: Motion3D) {
    this.rawAccel = accel;
    if (gyro) this.rawGyro = gyro;
    this.sensorState = "hardware_active";

    // 1. Precise Gravity Isolation
    if (gravity && (Math.abs(gravity.x) > 0.1 || Math.abs(gravity.y) > 0.1 || Math.abs(gravity.z) > 0.1)) {
      this.gravityVec = gravity;
      this.hasInitializedGravity = true;
    } else if (!this.hasInitializedGravity) {
      // First hardware reading establishes true orientation baseline (prevents initial fake step)
      this.gravityVec = { ...accel };
      this.hasInitializedGravity = true;
    } else {
      // Adaptive low-pass filter (92% gravity memory, 8% current acceleration)
      const alpha = 0.92;
      this.gravityVec.x = alpha * this.gravityVec.x + (1 - alpha) * accel.x;
      this.gravityVec.y = alpha * this.gravityVec.y + (1 - alpha) * accel.y;
      this.gravityVec.z = alpha * this.gravityVec.z + (1 - alpha) * accel.z;
    }

    // 2. Dynamic linear acceleration (gravity subtracted)
    const dynX = accel.x - this.gravityVec.x;
    const dynY = accel.y - this.gravityVec.y;
    const dynZ = accel.z - this.gravityVec.z;
    const dynamicMag = Math.sqrt(dynX * dynX + dynY * dynY + dynZ * dynZ);

    const gForce = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z) / 9.81;
    if (gForce > this.peakGForce) {
      this.peakGForce = parseFloat(gForce.toFixed(2));
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

  /**
   * STEP DETECTION ALGORITHM (True Peak-and-Valley State Machine)
   * Prevents fake steps while stationary or tilted.
   * Requires:
   * 1. Acceleration rises above peak threshold.
   * 2. Acceleration drops through valley threshold.
   * 3. Inter-step interval is within valid human cadence bounds (250ms - 2000ms).
   */
  private processStepDetection(dynamicMag: number, now: number) {
    const isRunning = this.mode === "run";
    const peakThreshold = isRunning ? 3.2 : 1.8; // m/s^2 dynamic peak
    const valleyThreshold = 0.85; // m/s^2 valley to complete ground release
    const minStepIntervalMs = isRunning ? 250 : 320; // Max ~240 SPM

    if (this.stepDetectorState === "LOOKING_FOR_PEAK") {
      if (dynamicMag > peakThreshold) {
        if (dynamicMag > this.currentStepPeakMag) {
          this.currentStepPeakMag = dynamicMag;
        } else if (dynamicMag < this.currentStepPeakMag - 0.35) {
          // Signal reached its local peak and started descending
          this.stepDetectorState = "LOOKING_FOR_VALLEY";
        }
      }
    } else if (this.stepDetectorState === "LOOKING_FOR_VALLEY") {
      if (dynamicMag < valleyThreshold) {
        // Valley reached! Verify time interval from last step
        const deltaMs = now - this.lastStepTimestamp;
        if (deltaMs >= minStepIntervalMs) {
          // Check gyro to ensure not just turning in place without foot strike
          const angRate = Math.sqrt(
            this.rawGyro.x * this.rawGyro.x +
            this.rawGyro.y * this.rawGyro.y +
            this.rawGyro.z * this.rawGyro.z
          );

          if (angRate < 12.0) {
            this.lastStepTimestamp = now;
            this.steps++;

            // Stride & Cadence calculation
            if (deltaMs <= 2500) {
              const instantSpm = Math.min(240, Math.max(45, 60000 / deltaMs));
              this.stepIntervalHistory.push(instantSpm);
              if (this.stepIntervalHistory.length > 5) this.stepIntervalHistory.shift();

              const avgSpm =
                this.stepIntervalHistory.reduce((a, b) => a + b, 0) /
                this.stepIntervalHistory.length;
              this.currentCadenceSpm = Math.round(avgSpm);

              // Biomechanical stride length based on height & cadence
              const heightM = this.userBody.heightCm / 100;
              const strideLengthM = heightM * (0.415 + (isRunning ? 0.0022 : 0.0012) * avgSpm);
              this.distanceKm = parseFloat((this.distanceKm + strideLengthM / 1000).toFixed(3));

              // Speed in km/h
              this.currentSpeedKmh = parseFloat(((strideLengthM * avgSpm * 60) / 1000).toFixed(1));

              // Heart rate exertion model based on cadence
              const cadenceRatio = Math.min(1.0, (avgSpm - 50) / 140);
              const targetHr = this.userBody.restingHr + cadenceRatio * (this.userBody.maxHr - this.userBody.restingHr);
              this.estimatedHeartRate = Math.round(this.estimatedHeartRate + (targetHr - this.estimatedHeartRate) * 0.2);
            }

            // Real physical calorie burn per actual step taken:
            // ~0.043 kcal per walk step, ~0.058 kcal per run step for 70kg human
            const kcalPerStep = (isRunning ? 0.058 : 0.043) * (this.userBody.weightKg / 70);
            this.activeCalories = parseFloat((this.activeCalories + kcalPerStep).toFixed(1));

            // Haptic feedback on step milestone
            if (this.steps % 250 === 0 && Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        }

        // Reset for next step cycle
        this.currentStepPeakMag = 0;
        this.stepDetectorState = "LOOKING_FOR_PEAK";
      }
    }
  }

  // Ambient steps counted when workout is not active
  private processAmbientStepDetection(dynamicMag: number, now: number) {
    if (this.ambientState === "PEAK") {
      if (dynamicMag > 2.0) {
        if (dynamicMag > this.ambientPeakMag) {
          this.ambientPeakMag = dynamicMag;
        } else if (dynamicMag < this.ambientPeakMag - 0.4) {
          this.ambientState = "VALLEY";
        }
      }
    } else {
      if (dynamicMag < 0.9) {
        if (now - this.lastStepTimestamp > 330) {
          this.lastStepTimestamp = now;
          this.dailyAmbientSteps++;
          if (this.dailyAmbientSteps % 10 === 0) {
            this.persistDailySteps();
          }
        }
        this.ambientPeakMag = 0;
        this.ambientState = "PEAK";
      }
    }
  }

  // Jump Rope Detection: Vertical Z-axis impulse and cadence
  private processJumpRopeDetection(dynZ: number, dynamicMag: number, now: number) {
    if (this.jumpState === "PEAK") {
      if (dynamicMag > 3.6 && Math.abs(dynZ) > 2.2) {
        if (dynamicMag > this.jumpPeakMag) {
          this.jumpPeakMag = dynamicMag;
        } else if (dynamicMag < this.jumpPeakMag - 0.5) {
          this.jumpState = "VALLEY";
        }
      }
    } else {
      if (dynamicMag < 1.2) {
        const deltaMs = now - this.lastJumpTimestamp;
        if (deltaMs >= 200) {
          this.lastJumpTimestamp = now;
          this.jumps++;

          if (deltaMs < 1500) {
            const instantRpm = Math.min(300, Math.max(60, 60000 / deltaMs));
            this.currentCadenceSpm = Math.round(instantRpm);
          }

          // Real calories per jump: ~0.14 kcal for 70kg human
          const kcalPerJump = 0.14 * (this.userBody.weightKg / 70);
          this.activeCalories = parseFloat((this.activeCalories + kcalPerJump).toFixed(1));

          if (this.jumps % 50 === 0 && Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
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
    this.currentCadenceSpm = 0;
    this.currentSpeedKmh = 0;
    this.estimatedHeartRate = this.userBody.restingHr;
    this.currentMet = WORKOUT_MODE_INFO[mode].baseMet;
    this.stepDetectorState = "LOOKING_FOR_PEAK";
    this.currentStepPeakMag = 0;
    this.hasInitializedGravity = false;
    this.stepIntervalHistory = [];

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
