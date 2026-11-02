import React, { useEffect, useRef, useMemo } from "react";
import { View, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Circle,
  Line,
  G,
  Rect,
} from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface NodeData {
  id: number;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  color: string;
}

interface Background3DBioFieldProps {
  pointerEvents?: "none" | "box-none" | "auto";
}

/**
 * Rock-Solid Stable Bio-Luminescent Ambient Field
 * ─────────────────────────────────────────────────────────────
 *  - 100% stationary: NO panning, NO movement, NO screen shifts.
 *  - Only a gentle, soothing bioluminescent light breathing pulse (pure GPU opacity).
 *  - Zero layout shifts, zero CPU churn, ultra-fast 120 FPS performance.
 *  - Total touch transparency (pointerEvents="none") for instant button responsiveness.
 */
export function Background3DBioField({
  pointerEvents = "none",
}: Background3DBioFieldProps) {
  // Soft, calming bioluminescent breathing pulse (GPU compositor opacity only)
  const pulseOpacity = useRef(new Animated.Value(0.55)).current;

  // Pre-compute fixed, stationary constellation nodes
  const { nodes, connections } = useMemo(() => {
    const rawNodes: NodeData[] = [];
    const count = 38;

    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const colors = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#ffffff"];

    for (let i = 0; i < count; i++) {
      const x = pseudoRandom() * SCREEN_WIDTH;
      const y = pseudoRandom() * SCREEN_HEIGHT;
      const radius = 1.4 + pseudoRandom() * 2.2;
      const opacity = 0.35 + pseudoRandom() * 0.45;
      const color = colors[Math.floor(pseudoRandom() * colors.length)];

      rawNodes.push({
        id: i,
        x,
        y,
        radius,
        opacity,
        color,
      });
    }

    const linePairs: { from: NodeData; to: NodeData; opacity: number }[] = [];
    const maxDist = 88;

    for (let i = 0; i < rawNodes.length; i++) {
      for (let j = i + 1; j < rawNodes.length; j++) {
        const dx = rawNodes[i].x - rawNodes[j].x;
        const dy = rawNodes[i].y - rawNodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const lineOpacity = (1 - dist / maxDist) * 0.22;
          linePairs.push({
            from: rawNodes[i],
            to: rawNodes[j],
            opacity: Math.max(0.04, Math.min(0.25, lineOpacity)),
          });
        }
      }
    }

    return { nodes: rawNodes, connections: linePairs };
  }, []);

  // Continuous subtle, soft breathing pulse on light opacity (no translation, no shifting)
  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.95,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.55,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    breathing.start();
    return () => breathing.stop();
  }, [pulseOpacity]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={pointerEvents}>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. STATIONARY EMERALD AMBIENT FLARES (Gentle Breathing Glow)   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: pulseOpacity },
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            {/* Soft Ambient Light Glow centered behind Hero Title */}
            <RadialGradient id="stableEmeraldAura" cx="35%" cy="45%" rx="65%" ry="50%">
              <Stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <Stop offset="45%" stopColor="#059669" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#060c09" stopOpacity="0" />
            </RadialGradient>
            {/* Top-Right Secondary Atmospheric Tint */}
            <RadialGradient id="stableTopFlare" cx="80%" cy="18%" rx="50%" ry="40%">
              <Stop offset="0%" stopColor="#34d399" stopOpacity="0.16" />
              <Stop offset="50%" stopColor="#10b981" stopOpacity="0.05" />
              <Stop offset="100%" stopColor="#060c09" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#stableEmeraldAura)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#stableTopFlare)" />
        </Svg>
      </Animated.View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. STATIONARY CONSTELLATION FILAMENTS & NODES (Rock Solid)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: pulseOpacity },
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="stableNodeHalo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <Stop offset="35%" stopColor="#34d399" stopOpacity="0.70" />
              <Stop offset="75%" stopColor="#10b981" stopOpacity="0.20" />
              <Stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Stationary Synaptic Filament Lines */}
          {connections.map((c, idx) => (
            <Line
              key={`line-${idx}`}
              x1={c.from.x}
              y1={c.from.y}
              x2={c.to.x}
              y2={c.to.y}
              stroke="#34d399"
              strokeWidth={0.9}
              strokeOpacity={c.opacity}
            />
          ))}

          {/* Stationary Luminous Nodes */}
          {nodes.map((n) => (
            <G key={`node-${n.id}`}>
              <Circle
                cx={n.x}
                cy={n.y}
                r={n.radius * 2.4}
                fill="url(#stableNodeHalo)"
                opacity={n.opacity * 0.45}
              />
              <Circle
                cx={n.x}
                cy={n.y}
                r={n.radius}
                fill={n.color}
                opacity={n.opacity * 0.9}
              />
            </G>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

export default Background3DBioField;
