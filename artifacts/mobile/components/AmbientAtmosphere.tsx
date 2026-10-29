import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import THEME from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AmbientAtmosphereProps {
  /** Mode: "editorial" (cover page warm champagne) or "dashboard" (eucalyptus + warm aura) */
  variant?: "editorial" | "dashboard";
}

export function AmbientAtmosphere({ variant = "dashboard" }: AmbientAtmosphereProps) {
  const isEditorial = variant === "editorial";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* Base background gradient */}
          <RadialGradient
            id="ambientTopAura"
            cx={isEditorial ? "50%" : "50%"}
            cy={isEditorial ? "22%" : "12%"}
            rx={isEditorial ? "85%" : "75%"}
            ry={isEditorial ? "45%" : "35%"}
            fx={isEditorial ? "50%" : "50%"}
            fy={isEditorial ? "20%" : "10%"}
            gradientUnits="userSpaceOnUse"
          >
            <Stop
              offset="0%"
              stopColor={isEditorial ? "#cfb9a5" : "#436a5b"}
              stopOpacity={isEditorial ? "0.45" : "0.55"}
            />
            <Stop
              offset="50%"
              stopColor={isEditorial ? "#9e826c" : "#243e35"}
              stopOpacity={isEditorial ? "0.25" : "0.30"}
            />
            <Stop
              offset="100%"
              stopColor={isEditorial ? "#1e1713" : "#111e19"}
              stopOpacity="0"
            />
          </RadialGradient>

          {/* Secondary warm accent glow orb */}
          <RadialGradient
            id="ambientWarmOrb"
            cx={isEditorial ? "75%" : "85%"}
            cy={isEditorial ? "60%" : "45%"}
            rx="50%"
            ry="35%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop
              offset="0%"
              stopColor={isEditorial ? "#b87a4c" : "#f97316"}
              stopOpacity={isEditorial ? "0.22" : "0.12"}
            />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>

          {/* Ambient soft bottom aura */}
          <RadialGradient
            id="ambientBottomAura"
            cx="30%"
            cy="85%"
            rx="60%"
            ry="30%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop
              offset="0%"
              stopColor={isEditorial ? "#8f7560" : "#10b981"}
              stopOpacity={isEditorial ? "0.15" : "0.10"}
            />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Base Solid Deep Tone */}
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={isEditorial ? "#201814" : THEME.colors.bgSolid}
        />

        {/* Luminous Diffuse Orbs */}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ambientTopAura)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ambientWarmOrb)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ambientBottomAura)" />
      </Svg>
    </View>
  );
}
