import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, Platform } from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Circle,
  Ellipse,
  Path as SvgPath,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Activity, Sparkles } from "lucide-react-native";

interface LiveBioCore3DProps {
  onPress?: () => void;
}

export function LiveBioCore3D({ onPress }: LiveBioCore3DProps) {
  // 60FPS Continuous Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const counterRotateAnim = useRef(new Animated.Value(0)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Organic Heartbeat & Circadian Breathing Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.96,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 2. 3D Gyroscopic Outer Orbital Rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 3. Counter-Rotation Inner Ring (Gyroscopic Gimbal Illusion)
    Animated.loop(
      Animated.timing(counterRotateAnim, {
        toValue: 1,
        duration: 6500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // 4. Expanding Concentric Bio-Waves
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim1, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(waveAnim2, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim2, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const counterSpin = counterRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });

  const waveScale1 = waveAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.8],
  });

  const waveOpacity1 = waveAnim1.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.35, 0],
  });

  const waveScale2 = waveAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.8],
  });

  const waveOpacity2 = waveAnim2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.6, 0.35, 0],
  });

  const handlePress = () => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    onPress?.();
  };

  return (
    <Pressable style={styles.container} onPress={handlePress} accessibilityLabel="Lumen 3D Bio-Core">
      {/* Left: 3D Holographic Bio-Orb in Continuous Motion */}
      <View style={styles.orbWrapper}>
        {/* Pulsing Concentric Energy Waves */}
        <Animated.View
          style={[
            styles.waveRing,
            {
              transform: [{ scale: waveScale1 }],
              opacity: waveOpacity1,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.waveRing,
            {
              transform: [{ scale: waveScale2 }],
              opacity: waveOpacity2,
            },
          ]}
        />

        {/* 3D Gyroscopic Outer Orbital Ring */}
        <Animated.View
          style={[
            styles.gyroRingWrapper,
            {
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <Svg width={56} height={56} viewBox="0 0 56 56">
            <Defs>
              <LinearGradient id="gyroGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <Stop offset="50%" stopColor="#06b6d4" stopOpacity="0.2" />
                <Stop offset="100%" stopColor="#f5ede4" stopOpacity="0.9" />
              </LinearGradient>
            </Defs>
            <Ellipse
              cx="28"
              cy="28"
              rx="24"
              ry="11"
              stroke="url(#gyroGrad1)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4 2"
            />
            {/* Luminous orbital satellite nodes */}
            <Circle cx="52" cy="28" r="2.5" fill="#f5ede4" />
            <Circle cx="4" cy="28" r="1.8" fill="#10b981" />
          </Svg>
        </Animated.View>

        {/* 3D Gyroscopic Inner Counter-Rotating Ring */}
        <Animated.View
          style={[
            styles.gyroRingWrapper,
            {
              transform: [{ rotate: counterSpin }],
            },
          ]}
        >
          <Svg width={56} height={56} viewBox="0 0 56 56">
            <Defs>
              <LinearGradient id="gyroGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#06b6d4" stopOpacity="0.75" />
                <Stop offset="50%" stopColor="#10b981" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#f5ede4" stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            <Ellipse
              cx="28"
              cy="28"
              rx="18"
              ry="8"
              stroke="url(#gyroGrad2)"
              strokeWidth="1.2"
              fill="none"
            />
            <Circle cx="46" cy="28" r="2" fill="#06b6d4" />
          </Svg>
        </Animated.View>

        {/* Central Luminous 3D Glowing Vital Core */}
        <Animated.View
          style={[
            styles.coreCenter,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Svg width={36} height={36} viewBox="0 0 36 36">
            <Defs>
              <RadialGradient id="coreGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <Stop offset="35%" stopColor="#34d399" stopOpacity="0.95" />
                <Stop offset="70%" stopColor="#059669" stopOpacity="0.6" />
                <Stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="18" cy="18" r="16" fill="url(#coreGlow)" />
            <Circle cx="18" cy="18" r="7" fill="#ffffff" />
            <Circle cx="18" cy="18" r="4" fill="#0b1612" />
          </Svg>
        </Animated.View>
      </View>

      {/* Right: Telemetry & Live 3D Bio-Engine Readout */}
      <View style={styles.telemetryInfo}>
        <View style={styles.statusBadgeRow}>
          <View style={styles.beaconCircle} />
          <Text style={styles.statusBadgeText}>3D BIO-CORE LIVE</Text>
        </View>

        <View style={styles.metricRow}>
          <Text style={styles.vitalityScore}>98.4%</Text>
          <Text style={styles.vitalityLabel}>Vitality Optimal</Text>
        </View>

        {/* Live Micro Heartbeat Wave */}
        <View style={styles.waveGraphicRow}>
          <Svg width={96} height={12} viewBox="0 0 96 12">
            <SvgPath
              d="M0 6 L20 6 L26 2 L32 10 L38 1 L44 11 L50 6 L96 6"
              fill="none"
              stroke="#34d399"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.circadianTag}>Circadian Engine</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(11, 22, 17, 0.78)",
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.16)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  orbWrapper: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  waveRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(52, 211, 153, 0.65)",
    backgroundColor: "rgba(52, 211, 153, 0.08)",
  },
  gyroRingWrapper: {
    position: "absolute",
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  coreCenter: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  telemetryInfo: {
    flex: 1,
    gap: 2,
  },
  statusBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  beaconCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34d399",
    shadowColor: "#34d399",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadgeText: {
    color: "#a7f3d0",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
  },
  vitalityScore: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  vitalityLabel: {
    color: "#d1fae5",
    fontSize: 10,
    fontWeight: "700",
  },
  waveGraphicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  circadianTag: {
    color: "#94a3b8",
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
