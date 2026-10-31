import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Platform,
  PanResponder,
} from "react-native";
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Line,
  G,
  Rect,
} from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface NodeData {
  id: number;
  baseX: number;
  baseY: number;
  z: number; // 0.4 (far) to 1.8 (near) for 3D depth
  radius: number;
  opacity: number;
  color: string;
  pulsePhase: number;
  connectedTo: number[];
}

interface Background3DBioFieldProps {
  pointerEvents?: "none" | "box-none" | "auto";
  interactive?: boolean;
}

export function Background3DBioField({
  pointerEvents = "none",
  interactive = true,
}: Background3DBioFieldProps) {
  // 1. Parallax Tilt Values (driven by touch/pan)
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  // 2. Global Circadian Breathing Pulse (120fps GPU native driver loop)
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // 3. Multi-Layer 3D Drift Oscillation
  const driftFarX = useRef(new Animated.Value(0)).current;
  const driftFarY = useRef(new Animated.Value(0)).current;
  const driftMidX = useRef(new Animated.Value(0)).current;
  const driftMidY = useRef(new Animated.Value(0)).current;
  const driftNearX = useRef(new Animated.Value(0)).current;
  const driftNearY = useRef(new Animated.Value(0)).current;

  // 4. Ambient Flare Drift
  const flareRotation = useRef(new Animated.Value(0)).current;
  const flareScale = useRef(new Animated.Value(1)).current;

  // Pre-compute 48 deterministic 3D Bio-Constellation Nodes
  const { nodes, connections } = useMemo(() => {
    const rawNodes: NodeData[] = [];
    const count = 46;

    // Pseudorandom deterministic seed to avoid hydration mismatch
    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const colors = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#ffffff"];

    for (let i = 0; i < count; i++) {
      const z = 0.45 + pseudoRandom() * 1.35; // 3D depth factor
      const baseX = pseudoRandom() * SCREEN_WIDTH;
      const baseY = pseudoRandom() * SCREEN_HEIGHT;
      const radius = (1.5 + pseudoRandom() * 2.8) * Math.min(z, 1.4);
      const opacity = 0.35 + (z / 1.8) * 0.55;
      const color = colors[Math.floor(pseudoRandom() * colors.length)];
      const pulsePhase = pseudoRandom() * Math.PI * 2;

      rawNodes.push({
        id: i,
        baseX,
        baseY,
        z,
        radius,
        opacity,
        color,
        pulsePhase,
        connectedTo: [],
      });
    }

    // Connect nearby nodes with neural synaptic filament lines
    const linePairs: { from: NodeData; to: NodeData; distance: number; opacity: number }[] = [];
    const maxDist = 95;

    for (let i = 0; i < rawNodes.length; i++) {
      for (let j = i + 1; j < rawNodes.length; j++) {
        const dx = rawNodes[i].baseX - rawNodes[j].baseX;
        const dy = rawNodes[i].baseY - rawNodes[j].baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist && Math.abs(rawNodes[i].z - rawNodes[j].z) < 0.6) {
          const lineOpacity = (1 - dist / maxDist) * 0.28 * Math.min(rawNodes[i].z, rawNodes[j].z);
          linePairs.push({
            from: rawNodes[i],
            to: rawNodes[j],
            distance: dist,
            opacity: Math.max(0.04, Math.min(0.35, lineOpacity)),
          });
        }
      }
    }

    return { nodes: rawNodes, connections: linePairs };
  }, []);

  // Set up continuous 60-120fps GPU-accelerated looping animations
  useEffect(() => {
    // A. Breathing Pulse (Inhale/Exhale 4.2s cycle)
    const breathingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // B. Far Layer Subtle Brownian Drift (14s organic loop)
    const driftFar = Animated.loop(
      Animated.sequence([
        Animated.timing(driftFarX, {
          toValue: 12,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(driftFarX, {
          toValue: -10,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const driftFarVert = Animated.loop(
      Animated.sequence([
        Animated.timing(driftFarY, {
          toValue: -15,
          duration: 8500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(driftFarY, {
          toValue: 12,
          duration: 8500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // C. Mid Layer Medium Drift (10s organic loop)
    const driftMid = Animated.loop(
      Animated.sequence([
        Animated.timing(driftMidX, {
          toValue: -22,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(driftMidX, {
          toValue: 20,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const driftMidVert = Animated.loop(
      Animated.sequence([
        Animated.timing(driftMidY, {
          toValue: 18,
          duration: 6400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(driftMidY, {
          toValue: -20,
          duration: 6400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // D. Near Layer Foreground Drift (8s fast parallax loop)
    const driftNear = Animated.loop(
      Animated.sequence([
        Animated.timing(driftNearX, {
          toValue: 32,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(driftNearX, {
          toValue: -30,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const driftNearVert = Animated.loop(
      Animated.sequence([
        Animated.timing(driftNearY, {
          toValue: -26,
          duration: 5000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(driftNearY, {
          toValue: 28,
          duration: 5000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // E. Ambient Flare Slow Rotation (30s continuous 360 loop)
    const flareRot = Animated.loop(
      Animated.timing(flareRotation, {
        toValue: 1,
        duration: 28000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const flarePulse = Animated.loop(
      Animated.sequence([
        Animated.timing(flareScale, {
          toValue: 1.15,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flareScale, {
          toValue: 0.92,
          duration: 6000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    breathingLoop.start();
    driftFar.start();
    driftFarVert.start();
    driftMid.start();
    driftMidVert.start();
    driftNear.start();
    driftNearVert.start();
    flareRot.start();
    flarePulse.start();

    return () => {
      breathingLoop.stop();
      driftFar.stop();
      driftFarVert.stop();
      driftMid.stop();
      driftMidVert.stop();
      driftNear.stop();
      driftNearVert.stop();
      flareRot.stop();
      flarePulse.stop();
    };
  }, []);

  // 3D Parallax Touch Responder
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => interactive,
      onMoveShouldSetPanResponder: () => interactive,
      onPanResponderMove: (_, gestureState) => {
        // Smooth dampening to 28px max tilt
        const clampedX = Math.max(-28, Math.min(28, gestureState.dx * 0.12));
        const clampedY = Math.max(-28, Math.min(28, gestureState.dy * 0.12));

        Animated.spring(panX, {
          toValue: clampedX,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();

        Animated.spring(panY, {
          toValue: clampedY,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderRelease: () => {
        // Return smoothly to center resting position
        Animated.spring(panX, {
          toValue: 0,
          friction: 6,
          tension: 30,
          useNativeDriver: true,
        }).start();
        Animated.spring(panY, {
          toValue: 0,
          friction: 6,
          tension: 30,
          useNativeDriver: true,
        }).start();
      },
    });
  }, [interactive]);

  // Interpolate rotation for ambient flares
  const flareRotateDeg = flareRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Layer-specific combined translations (Drift + Parallax scaled by Z-depth)
  const farTransform = {
    transform: [
      { translateX: Animated.add(driftFarX, Animated.multiply(panX, 0.45)) },
      { translateY: Animated.add(driftFarY, Animated.multiply(panY, 0.45)) },
    ],
  };

  const midTransform = {
    transform: [
      { translateX: Animated.add(driftMidX, Animated.multiply(panX, 1.0)) },
      { translateY: Animated.add(driftMidY, Animated.multiply(panY, 1.0)) },
    ],
  };

  const nearTransform = {
    transform: [
      { translateX: Animated.add(driftNearX, Animated.multiply(panX, 1.7)) },
      { translateY: Animated.add(driftNearY, Animated.multiply(panY, 1.7)) },
    ],
  };

  const flareTransform = {
    transform: [
      { rotate: flareRotateDeg },
      { scale: flareScale },
      { translateX: Animated.multiply(panX, 0.3) },
      { translateY: Animated.multiply(panY, 0.3) },
    ],
  };

  // Separate nodes by 3D depth plane for hardware-layer rendering
  const farNodes = useMemo(() => nodes.filter((n) => n.z < 0.85), [nodes]);
  const midNodes = useMemo(() => nodes.filter((n) => n.z >= 0.85 && n.z < 1.35), [nodes]);
  const nearNodes = useMemo(() => nodes.filter((n) => n.z >= 1.35), [nodes]);

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={pointerEvents}
      {...(interactive ? panResponder.panHandlers : {})}
    >
      {/* ───────────────────────────────────────────────────────────── */}
      {/* LAYER 1: AMBIENT 3D BIOLUMINESCENT LIGHT FLARES               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, flareTransform]}>
        <Svg width="100%" height="100%">
          <Defs>
            {/* Top-Right Emerald Light Flare */}
            <RadialGradient id="topEmeraldFlare" cx="75%" cy="22%" rx="55%" ry="45%">
              <Stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <Stop offset="45%" stopColor="#059669" stopOpacity="0.09" />
              <Stop offset="100%" stopColor="#060c09" stopOpacity="0" />
            </RadialGradient>
            {/* Center-Left Mint Ambient Core Glow */}
            <RadialGradient id="centerMintGlow" cx="20%" cy="58%" rx="65%" ry="50%">
              <Stop offset="0%" stopColor="#34d399" stopOpacity="0.18" />
              <Stop offset="50%" stopColor="#10b981" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#060c09" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#topEmeraldFlare)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#centerMintGlow)" />
        </Svg>
      </Animated.View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LAYER 2: DEEP (FAR) 3D CONSTELLATION LAYER                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, farTransform]}>
        <Svg width="100%" height="100%">
          {/* Far Synaptic Filaments */}
          {connections
            .filter((c) => c.from.z < 0.9 && c.to.z < 0.9)
            .map((c, idx) => (
              <Line
                key={`far-line-${idx}`}
                x1={c.from.baseX}
                y1={c.from.baseY}
                x2={c.to.baseX}
                y2={c.to.baseY}
                stroke="#10b981"
                strokeWidth={0.8}
                strokeOpacity={c.opacity * 0.7}
              />
            ))}
          {/* Far Nodes */}
          {farNodes.map((n) => (
            <G key={`far-node-${n.id}`}>
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius * 2.2}
                fill={n.color}
                opacity={n.opacity * 0.18}
              />
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius}
                fill={n.color}
                opacity={n.opacity * 0.65}
              />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LAYER 3: MID-DEPTH 3D NEURAL FILAMENTS & NODES               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, midTransform]}>
        <Svg width="100%" height="100%">
          {/* Mid Synaptic Filaments */}
          {connections
            .filter((c) => c.from.z >= 0.85 && c.from.z < 1.35)
            .map((c, idx) => (
              <Line
                key={`mid-line-${idx}`}
                x1={c.from.baseX}
                y1={c.from.baseY}
                x2={c.to.baseX}
                y2={c.to.baseY}
                stroke="#34d399"
                strokeWidth={1.2}
                strokeOpacity={c.opacity * 0.85}
              />
            ))}
          {/* Mid Nodes */}
          {midNodes.map((n) => (
            <G key={`mid-node-${n.id}`}>
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius * 2.8}
                fill="#10b981"
                opacity={n.opacity * 0.22}
              />
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius}
                fill={n.color}
                opacity={n.opacity * 0.85}
              />
            </G>
          ))}
        </Svg>
      </Animated.View>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LAYER 4: NEAR (FOREGROUND) 3D LUMINOUS BIO-PARTICLES          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, nearTransform]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="nearNodeGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <Stop offset="30%" stopColor="#34d399" stopOpacity="0.75" />
              <Stop offset="70%" stopColor="#10b981" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Near Synaptic Filaments */}
          {connections
            .filter((c) => c.from.z >= 1.35 || c.to.z >= 1.35)
            .map((c, idx) => (
              <Line
                key={`near-line-${idx}`}
                x1={c.from.baseX}
                y1={c.from.baseY}
                x2={c.to.baseX}
                y2={c.to.baseY}
                stroke="#6ee7b7"
                strokeWidth={1.6}
                strokeOpacity={c.opacity}
              />
            ))}
          {/* Near Nodes with Intense Bioluminescent Halo */}
          {nearNodes.map((n) => (
            <G key={`near-node-${n.id}`}>
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius * 3.6}
                fill="url(#nearNodeGlow)"
                opacity={n.opacity * 0.6}
              />
              <Circle
                cx={n.baseX}
                cy={n.baseY}
                r={n.radius * 1.2}
                fill="#ffffff"
                opacity={0.95}
              />
            </G>
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

export default Background3DBioField;
