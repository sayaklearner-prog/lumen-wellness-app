import { Platform } from "react-native";

export function speakText(text: string, onDone?: () => void) {
  if (Platform.OS === "web") {
    // Use browser SpeechSynthesis API on web
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.onend = () => onDone?.();
      window.speechSynthesis.speak(utterance);
    } catch {
      console.warn("Web SpeechSynthesis not available");
      onDone?.();
    }
    return;
  }

  try {
    const Speech = require("expo-speech");
    Speech.speak(text, {
      language: "en-US",
      pitch: 1.0,
      rate: 1.0,
      onDone,
      onError: (err: any) => console.warn("TTS Speech error", err)
    });
  } catch (err) {
    console.error("Speech module error", err);
  }
}

export function stopSpeaking() {
  if (Platform.OS === "web") {
    try { window.speechSynthesis.cancel(); } catch {}
    return;
  }

  try {
    const Speech = require("expo-speech");
    Speech.stop();
  } catch (err) {
    console.error("Failed to stop Speech playback", err);
  }
}

export interface VoiceCommandResult {
  action: "log_water" | "start_workout" | "briefing" | "unknown";
  value?: any;
  explanation: string;
}

export function parseVoiceCommand(transcript: string): VoiceCommandResult {
  const clean = transcript.toLowerCase().trim();
  
  if (clean.includes("water") || clean.includes("hydrate")) {
    const match = clean.match(/(\d+)/);
    const amount = match ? parseInt(match[0]) : 250;
    return {
      action: "log_water",
      value: amount,
      explanation: `Logging ${amount}ml of water to your hydration tracker.`
    };
  }
  
  if (clean.includes("workout") || clean.includes("exercise") || clean.includes("activity")) {
    return {
      action: "start_workout",
      value: "Running",
      explanation: "Starting today's fitness workout tracking."
    };
  }

  if (clean.includes("briefing") || clean.includes("summary") || clean.includes("analyze")) {
    return {
      action: "briefing",
      explanation: "Analyzing your dashboard metrics and reading today's briefing."
    };
  }

  return {
    action: "unknown",
    explanation: "I heard you, but I'm not sure how to log that metric yet. Try saying 'log 500ml water' or 'read my briefing'."
  };
}
