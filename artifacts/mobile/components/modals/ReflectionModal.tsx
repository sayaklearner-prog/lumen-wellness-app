import React, { useState, memo } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Platform } from "react-native";
import { Sparkles, Star, Check } from "lucide-react-native";
import THEME from "@/constants/theme";

const triggerHaptic = (style?: string) => {
  if (Platform.OS === "web") return;
  try {
    const Haptics = require("expo-haptics");
    if (style === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {}
};

export interface ReflectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (score: number, note: string) => void;
  initialScore?: number;
  initialNote?: string;
}

export const ReflectionModal = memo(function ReflectionModal({
  visible,
  onClose,
  onConfirm,
  initialScore = 5,
  initialNote = "",
}: ReflectionModalProps) {
  const [reflectionScore, setReflectionScore] = useState(initialScore);
  const [reflectionNote, setReflectionNote] = useState(initialNote);

  const handleConfirm = () => {
    triggerHaptic("success");
    onConfirm(reflectionScore, reflectionNote);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.reflectionPanel}>
          <Sparkles size={28} color="#10b981" />
          <Text style={styles.reflectionTitle}>Focus Session Complete!</Text>
          <Text style={styles.reflectionSub}>How focused did you feel during this session?</Text>
          <View style={styles.reflectionStarsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => {
                  triggerHaptic();
                  setReflectionScore(star);
                }}
                style={{ padding: 6 }}
              >
                <Star
                  size={28}
                  color={reflectionScore >= star ? "#f59e0b" : "#475569"}
                  fill={reflectionScore >= star ? "#f59e0b" : "transparent"}
                />
              </Pressable>
            ))}
          </View>
          <View style={styles.reflectionChipsRow}>
            {["Deep Flow", "High Output", "Minor Distractions", "Refreshed"].map((tag) => (
              <Pressable
                key={tag}
                style={[styles.reflectionChip, reflectionNote === tag && styles.reflectionChipActive]}
                onPress={() => {
                  triggerHaptic();
                  setReflectionNote(tag);
                }}
              >
                <Text
                  style={[
                    styles.reflectionChipText,
                    reflectionNote === tag && styles.reflectionChipTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.modalPrimaryBtn, { backgroundColor: "#10b981", marginTop: 14 }]}
            onPress={handleConfirm}
          >
            <Check size={16} color="#050b08" style={{ marginRight: 6 }} />
            <Text style={styles.modalPrimaryBtnText}>Log to Health OS</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  reflectionPanel: {
    width: "90%",
    maxWidth: 360,
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: "center",
  },
  reflectionTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 10,
  },
  reflectionSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  reflectionStarsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  reflectionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
  },
  reflectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
  },
  reflectionChipActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  reflectionChipText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  reflectionChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  modalPrimaryBtn: {
    flexDirection: "row",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: {
    color: "#050b08",
    fontSize: 15,
    fontWeight: "800",
  },
});
