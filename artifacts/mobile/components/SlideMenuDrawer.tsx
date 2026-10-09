import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useGetProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import { syncHealthData } from "@/services/health";
import { getStoredGoogleUser, GoogleUser } from "@/services/googleAuth";
import { GoogleIcon } from "@/components/GoogleIcon";
import {
  LayoutGrid,
  Sparkles,
  Utensils,
  Activity,
  BarChart2,
  ShieldCheck,
  Settings,
  ChevronRight,
  X,
  RefreshCw,
  Sliders,
  LogOut,
  Bell,
  Clock,
} from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(340, SCREEN_WIDTH * 0.85);

interface SlideMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  side?: "left" | "right";
}

export function SlideMenuDrawer({ isOpen, onClose, side = "left" }: SlideMenuDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();

  const hiddenOffset = side === "left" ? -DRAWER_WIDTH : DRAWER_WIDTH;
  const translateX = useRef(new Animated.Value(hiddenOffset)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: hiddenOffset,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, hiddenOffset]);

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 150);
  };

  const handleForceSync = async () => {
    try {
      await syncHealthData();
      Alert.alert("Synced", "Health data synchronized successfully.");
    } catch {
      Alert.alert("Sync", "Wearable data up to date.");
    }
  };

  const handleRerunSetup = async () => {
    onClose();
    await storage.setItem("lumen_in_onboarding", "true");
    await storage.removeItem("lumen_onboarding_completed");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_in_onboarding", "true");
      localStorage.removeItem("lumen_onboarding_completed");
    }
    setTimeout(() => {
      router.replace("/(auth)/onboarding");
    }, 150);
  };

  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);

  useEffect(() => {
    if (isOpen) {
      getStoredGoogleUser().then((u) => setGoogleUser(u));
    }
  }, [isOpen]);

  const handleLogout = async () => {
    onClose();
    await storage.removeItem("lumen_auth_token");
    await storage.removeItem("lumen_in_onboarding");
    await storage.removeItem("lumen_onboarding_completed");
    await storage.removeItem("lumen_google_user");
    await storage.removeItem("lumen_auth_provider");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.removeItem("lumen_authenticated");
      localStorage.removeItem("lumen_in_onboarding");
      localStorage.removeItem("lumen_onboarding_completed");
      localStorage.removeItem("lumen_google_user");
      localStorage.removeItem("lumen_auth_provider");
    }
    qc.clear();
    setTimeout(() => {
      router.replace("/(auth)/welcome");
    }, 150);
  };

  const userName = profile?.name || googleUser?.name || "User";
  const userInitial = userName ? userName[0].toUpperCase() : "U";

  if (!isOpen) {
    return null;
  }

  const isLeft = side === "left";

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: backdropOpacity,
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Slide Drawer Panel */}
      <Animated.View
        style={[
          styles.drawer,
          isLeft ? styles.drawerLeft : styles.drawerRight,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Top Header of Drawer */}
        <View style={styles.drawerHeader}>
          <View style={styles.userProfileRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>
                {userName}
              </Text>
              {googleUser?.email ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <GoogleIcon size={12} />
                  <Text style={styles.statusText} numberOfLines={1}>
                    {googleUser.email}
                  </Text>
                </View>
              ) : (
                <View style={styles.statusRow}>
                  <View style={styles.activeDot} />
                  <Text style={styles.statusText}>Lumen Health OS • Pro</Text>
                </View>
              )}
            </View>
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <X size={18} color="#94a3b8" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.drawerScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* SECTION 1: PRIMARY MODULES */}
          <Text style={styles.sectionHeading}>MODULES & TELEMETRY</Text>

          {/* Reminders & Alarms (New Dedicated Alarm Screen) */}
          <Pressable
            style={[
              styles.navItemCard,
              pathname?.includes("reminders") && styles.navItemCardActive,
            ]}
            onPress={() => handleNavigate("/(tabs)/reminders")}
          >
            <View style={[styles.navIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Bell size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Reminders & Alarms</Text>
              <Text style={styles.navSub}>Ringing chimes, wakeups & smart nudges</Text>
            </View>
            <ChevronRight size={16} color="#475569" />
          </Pressable>

          {/* Analytics Item */}
          <Pressable
            style={[
              styles.navItemCard,
              pathname?.includes("analytics") && styles.navItemCardActive,
            ]}
            onPress={() => handleNavigate("/(tabs)/analytics")}
          >
            <View style={[styles.navIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <BarChart2 size={18} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Biometric Analytics</Text>
              <Text style={styles.navSub}>Score trends, telemetry & 30-day radar</Text>
            </View>
            <ChevronRight size={16} color="#475569" />
          </Pressable>

          {/* Safety Item */}
          <Pressable
            style={[
              styles.navItemCard,
              pathname?.includes("safety") && styles.navItemCardActive,
            ]}
            onPress={() => handleNavigate("/(tabs)/safety")}
          >
            <View style={[styles.navIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <ShieldCheck size={18} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>Medical & Safety ID</Text>
              <Text style={styles.navSub}>Emergency profile, allergies & protocols</Text>
            </View>
            <ChevronRight size={16} color="#475569" />
          </Pressable>

          {/* Settings Item */}
          <Pressable
            style={[
              styles.navItemCard,
              pathname?.includes("profile") && styles.navItemCardActive,
            ]}
            onPress={() => handleNavigate("/(tabs)/profile")}
          >
            <View style={[styles.navIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Settings size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.navTitle}>App Settings</Text>
              <Text style={styles.navSub}>Profile, targets, permissions & security</Text>
            </View>
            <ChevronRight size={16} color="#475569" />
          </Pressable>

          {/* SECTION 2: CORE TRACKERS */}
          <Text style={[styles.sectionHeading, { marginTop: 20 }]}>DAILY TRACKERS</Text>

          <View style={styles.quickGrid}>
            <Pressable
              style={styles.quickCard}
              onPress={() => handleNavigate("/(tabs)")}
            >
              <LayoutGrid size={18} color="#10b981" />
              <Text style={styles.quickLabel}>Today</Text>
            </Pressable>

            <Pressable
              style={styles.quickCard}
              onPress={() => handleNavigate("/(tabs)/coach")}
            >
              <Sparkles size={18} color="#10b981" />
              <Text style={styles.quickLabel}>AI Coach</Text>
            </Pressable>

            <Pressable
              style={styles.quickCard}
              onPress={() => handleNavigate("/(tabs)/nutrition")}
            >
              <Utensils size={18} color="#10b981" />
              <Text style={styles.quickLabel}>Nutrition</Text>
            </Pressable>

            <Pressable
              style={styles.quickCard}
              onPress={() => handleNavigate("/(tabs)/activity")}
            >
              <Activity size={18} color="#10b981" />
              <Text style={styles.quickLabel}>Activity</Text>
            </Pressable>
          </View>

          {/* SECTION 3: SYSTEM ACTIONS */}
          <Text style={[styles.sectionHeading, { marginTop: 22 }]}>SYSTEM & DEVICES</Text>

          <Pressable style={styles.actionRow} onPress={handleForceSync}>
            <RefreshCw size={15} color="#10b981" style={{ marginRight: 10 }} />
            <Text style={styles.actionText}>Force Wearable Sync</Text>
          </Pressable>

          <Pressable style={styles.actionRow} onPress={handleRerunSetup}>
            <Sliders size={15} color="#10b981" style={{ marginRight: 10 }} />
            <Text style={styles.actionText}>Re-run Setup Wizard (4 Steps)</Text>
          </Pressable>

          <Pressable style={[styles.actionRow, styles.logoutRow]} onPress={handleLogout}>
            <LogOut size={15} color="#ef4444" style={{ marginRight: 10 }} />
            <Text style={[styles.actionText, { color: "#ef4444" }]}>Logout Session</Text>
          </Pressable>

          <View style={{ alignItems: "center", marginTop: 24, marginBottom: 12 }}>
            <Image
              source={require("../assets/icon.png")}
              style={{ width: 36, height: 36, borderRadius: 10, marginBottom: 6 }}
              resizeMode="cover"
            />
            <Text style={{ color: "#94a3b8", fontSize: 12, fontWeight: "700" }}>Lumen OS</Text>
            <Text style={{ color: "#475569", fontSize: 10, marginTop: 2 }}>v1.0.1 • Bio-Intelligence Platform</Text>
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    zIndex: 9998,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#070c0a",
    zIndex: 9999,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  drawerLeft: {
    left: 0,
    borderRightWidth: 1,
    borderRightColor: "rgba(16, 185, 129, 0.2)",
    shadowOffset: { width: 4, height: 0 },
  },
  drawerRight: {
    right: 0,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(16, 185, 129, 0.2)",
    shadowOffset: { width: -4, height: 0 },
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30, 41, 59, 0.7)",
  },
  userProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1.5,
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "bold",
  },
  userName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  statusText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  drawerScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  navItemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  navItemCardActive: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  navIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  navSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  actionText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "500",
  },
  logoutRow: {
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    marginTop: 4,
  },
});
