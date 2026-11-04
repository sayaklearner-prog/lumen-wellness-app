import { Platform, Vibration } from "react-native";
import { stopNativeAlarmSound } from "./notifications";

let activeAudioCtx: any = null;
let activeInterval: any = null;
let onAlarmTriggerListeners: Array<(reminder: any) => void> = [];

export function subscribeToAlarms(listener: (reminder: any) => void) {
  onAlarmTriggerListeners.push(listener);
  return () => {
    onAlarmTriggerListeners = onAlarmTriggerListeners.filter((l) => l !== listener);
  };
}

export function notifyAlarmTriggered(reminder: any) {
  onAlarmTriggerListeners.forEach((listener) => {
    try {
      listener(reminder);
    } catch (e) {
      console.warn("Alarm trigger listener error:", e);
    }
  });
}

// Global listener for native Android AlarmManager triggers
if (typeof window !== "undefined") {
  window.addEventListener("lumenAlarmRinging", (e: any) => {
    const detail = e?.detail || {};
    notifyAlarmTriggered({
      id: detail.id ? String(detail.id) : `alarm-${Date.now()}`,
      title: detail.title || "Lumen Health Alarm",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
      enabled: true,
      soundEnabled: true,
      isAi: false,
    });
  });
}

/**
 * High-fidelity phone alarm sound generator.
 * Works natively via Android Alarm stream and Web Audio synthesizer fallback.
 * Rings continuously until user taps Snooze or Dismiss (up to 90s safety timeout).
 */
export function playAlarmSound(durationSeconds = 60): { stop: () => void } {
  stopAlarm();

  // 1. Heavy phone alarm vibration pattern: Vibrate 800ms, pause 400ms, repeat
  try {
    if (Platform.OS !== "web") {
      Vibration.vibrate([0, 800, 400, 800, 400, 1000], true);
    }
  } catch {}

  // 2. Synthesized acoustic chime through Web Audio API
  try {
    const AudioCtx =
      (typeof window !== "undefined" && (window as any).AudioContext) ||
      (typeof window !== "undefined" && (window as any).webkitAudioContext);

    if (AudioCtx) {
      const ctx = new AudioCtx();
      activeAudioCtx = ctx;

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Harmonic chords: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
      const chord = [523.25, 659.25, 783.99, 1046.5];
      let scheduledCycle = 0;
      const maxCycles = Math.ceil(durationSeconds / 1.0);

      const playCycle = () => {
        if (!activeAudioCtx || scheduledCycle >= maxCycles) {
          stopAlarm();
          return;
        }

        const now = ctx.currentTime;
        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          // Fast punchy attack, bright resonance decay
          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.55);
        });

        scheduledCycle++;
      };

      playCycle();
      activeInterval = setInterval(playCycle, 1000);
    }
  } catch (err) {
    console.warn("Could not start Web Audio alarm chime:", err);
  }

  return {
    stop: stopAlarm,
  };
}

export function stopAlarm() {
  try {
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }
    if (activeAudioCtx) {
      activeAudioCtx.close?.();
      activeAudioCtx = null;
    }
    Vibration.cancel();
  } catch (err) {
    console.warn("Error stopping alarm:", err);
  }

  // Also stop native Android Ringtone / MediaPlayer
  try {
    stopNativeAlarmSound();
  } catch {}
}
