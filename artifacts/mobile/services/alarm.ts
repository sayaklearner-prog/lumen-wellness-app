import { Platform, Vibration } from "react-native";

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

/**
 * High-fidelity synthesized bell chime alarm that works reliably in
 * mobile WebView, Capacitor Android, and iOS without external audio files.
 */
export function playAlarmSound(durationSeconds = 12): { stop: () => void } {
  stopAlarm();

  // 1. Vibration pattern (vibrate, pause, vibrate, pause)
  try {
    if (Platform.OS !== "web") {
      Vibration.vibrate([500, 300, 500, 300, 500, 500], true);
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

      // Pleasant ringing bell arpeggio chords: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
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

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          // Bell strike envelope (fast attack, natural exponential decay)
          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.45);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.5);
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
}
