import React, { useState, useEffect, memo } from "react";
import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { Wind } from "lucide-react-native";
import THEME from "@/constants/theme";

export interface BreathingModalProps {
  visible: boolean;
  onClose: () => void;
  initialSeconds?: number;
}

export const BreathingModal = memo(function BreathingModal({
  visible,
  onClose,
  initialSeconds = 60,
}: BreathingModalProps) {
  const [breathingSeconds, setBreathingSeconds] = useState(initialSeconds);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (visible) {
      setBreathingSeconds(initialSeconds);
      interval = setInterval(() => {
        setBreathingSeconds((prev) => {
          if (prev <= 1) {
            onClose();
            return initialSeconds;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, initialSeconds, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.breathingBackdrop}>
        <View style={styles.breathingPanel}>
          <Wind size={36} color="#38bdf8" />
          <Text style={styles.breathingTitle}>Mindful Breath</Text>
          <Text style={styles.breathingSub}>
            Box Breathing: Inhale 4s • Hold 4s • Exhale 4s
          </Text>
          <View style={styles.breathingCircle}>
            <Text style={styles.breathingCounter}>{breathingSeconds}s</Text>
            <Text style={styles.breathingPill}>
              {breathingSeconds % 16 < 4
                ? "Inhale Deeply"
                : breathingSeconds % 16 < 8
                ? "Hold Breath"
                : breathingSeconds % 16 < 12
                ? "Exhale Slowly"
                : "Rest & Be Still"}
            </Text>
          </View>
          <Pressable style={styles.breathingDismissBtn} onPress={onClose}>
            <Text style={styles.breathingDismissText}>Return to Focus</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  breathingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 11, 8, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  breathingPanel: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: "center",
  },
  breathingTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12,
  },
  breathingSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  breathingCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  breathingCounter: {
    fontSize: 38,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  breathingPill: {
    color: "#0284c7",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  breathingDismissBtn: {
    backgroundColor: THEME.colors.accentTeal,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.accentTeal,
  },
  breathingDismissText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
});
