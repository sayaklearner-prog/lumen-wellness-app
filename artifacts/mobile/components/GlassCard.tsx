import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import THEME from "@/constants/theme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: THEME.radii.xl,
    padding: THEME.spacing.xl,
    ...THEME.shadows.card,
  },
});
