import { View, Text, StyleSheet, Pressable, ImageBackground, Dimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { storage } from "@/services/storage";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { Activity, ShieldCheck, ChevronRight } from "lucide-react-native";

const { width } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const handleGetStarted = async () => {
    await storage.setItem("lumen_auth_token", "authenticated");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_authenticated", "true");
    }
    qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
    router.replace("/(auth)/onboarding");
  };

  const handleSignIn = async () => {
    await storage.setItem("lumen_auth_token", "authenticated");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_authenticated", "true");
    }
    qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
  };

  return (
    <View style={styles.container}>
      {/* Botanical ambient gradient effect */}
      <View style={styles.radialGlow} />

      <View style={styles.content}>
        {/* Logo Header */}
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Activity size={20} color="#10b981" />
          </View>
          <Text style={styles.logoText}>Lumen OS</Text>
        </View>

        {/* Copy Area */}
        <View style={styles.copyArea}>
          <Text style={styles.tagline}>Your AI Health Companion.</Text>
          <Text style={styles.desc}>
            Understand your body. Track your lifestyle. Get personalized AI-powered health guidance every single day.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          <Pressable style={styles.primaryBtn} onPress={handleGetStarted}>
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <ChevronRight size={16} color="#050b08" />
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={handleSignIn}>
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </Pressable>
        </View>

        {/* Branding Footer */}
        <View style={styles.footer}>
          <ShieldCheck size={14} color="#10b981" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>Secure on-device storage. Created by MeshMind.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    justifyContent: "space-between",
  },
  radialGlow: {
    position: "absolute",
    top: "10%",
    left: "50%",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    transform: [{ translateX: -150 }],
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#e2e8f0",
  },
  copyArea: {
    marginTop: 60,
  },
  tagline: {
    fontSize: 48,
    fontWeight: "900",
    color: "#f8fafc",
    lineHeight: 52,
    marginBottom: 20,
  },
  desc: {
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 24,
  },
  btnRow: {
    gap: 15,
    marginTop: 40,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: "#10b981",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  primaryBtnText: {
    color: "#050b08",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryBtn: {
    height: 52,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
  },
  footerText: {
    fontSize: 12,
    color: "#64748b",
  },
});
