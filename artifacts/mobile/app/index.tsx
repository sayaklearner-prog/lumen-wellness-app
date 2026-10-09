import { useEffect } from "react";
import { View, ActivityIndicator, Text, Image, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { storage } from "@/services/storage";

/**
 * Root Entry Point (app/index.tsx)
 * Controls initial route resolution on app launch:
 * - First-time user / unauthenticated: Opens Cover Page (/(auth)/welcome) first.
 * - Logged-in user: Opens Dashboard (/(tabs)) first.
 */
export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkInitialRoute() {
      try {
        const token = await storage.getItem("lumen_auth_token");
        const webAuth =
          Platform.OS === "web" &&
          typeof localStorage !== "undefined" &&
          localStorage.getItem("lumen_authenticated") === "true";

        const isAuthenticated = token === "authenticated" || webAuth;

        if (!isMounted) return;

        if (isAuthenticated) {
          // User is logged in -> Open Dashboard first
          router.replace("/(tabs)");
        } else {
          // First time opening app / logged out -> Open Cover Page first
          router.replace("/(auth)/welcome");
        }
      } catch (err) {
        if (!isMounted) return;
        // On fresh install or storage error, default safely to Cover page
        router.replace("/(auth)/welcome");
      }
    }

    checkInitialRoute();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/icon.png")}
        style={styles.logo}
        resizeMode="cover"
      />
      <Text style={styles.title}>Lumen OS</Text>
      <Text style={styles.subtitle}>Bio-Intelligence Platform</Text>
      <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    marginBottom: 16,
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 4,
  },
});
