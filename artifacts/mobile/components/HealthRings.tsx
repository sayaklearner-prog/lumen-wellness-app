import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface HealthRingProps {
  size: number;
  strokeWidth: number;
  percentage: number; // 0 to 100
  color: string;
  backgroundColor: string;
  icon?: string;
}

export function HealthRing({
  size,
  strokeWidth,
  percentage,
  color,
  backgroundColor,
  icon,
}: HealthRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background track circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Foreground progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {icon && (
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      )}
    </View>
  );
}

interface MultiRingsProps {
  stepsPercent: number;
  sleepPercent: number;
  activePercent: number;
}

export function MultiHealthRings({
  stepsPercent,
  sleepPercent,
  activePercent,
}: MultiRingsProps) {
  return (
    <View style={styles.multiContainer}>
      {/* Steps Ring */}
      <HealthRing
        size={110}
        strokeWidth={12}
        percentage={stepsPercent}
        color="#10b981" // Emerald
        backgroundColor="rgba(16, 185, 129, 0.15)"
        icon="👟"
      />
      
      {/* Sleep Ring */}
      <View style={[styles.absoluteRing, { left: 15, top: 15 }]}>
        <HealthRing
          size={80}
          strokeWidth={12}
          percentage={sleepPercent}
          color="#3b82f6" // Blue
          backgroundColor="rgba(59, 130, 246, 0.15)"
          icon="🌙"
        />
      </View>
      
      {/* Active Ring */}
      <View style={[styles.absoluteRing, { left: 30, top: 30 }]}>
        <HealthRing
          size={50}
          strokeWidth={10}
          percentage={activePercent}
          color="#f59e0b" // Amber
          backgroundColor="rgba(245, 158, 11, 0.15)"
          icon="⚡"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  svg: {
    position: "absolute",
  },
  iconContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 12,
  },
  multiContainer: {
    width: 110,
    height: 110,
    position: "relative",
  },
  absoluteRing: {
    position: "absolute",
  },
});
