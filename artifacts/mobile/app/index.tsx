import { useEffect } from "react";
import { View, ActivityIndicator, Text, Image, StyleSheet, Platform } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { storage } from "@/services/storage";
import { parseGoogleAuthRedirect, saveGoogleUserSession } from "@/services/googleAuth";

/**
 * Root Entry Point (app/index.tsx)
 * Controls initial route resolution on app launch:
 * - Google OAuth Callback: intercepts #access_token=... and routes to Onboarding.
 * - First-time user / unauthenticated: Opens Cover Page (/(auth)/welcome) first.
 * - Logged-in user: Opens Dashboard (/(tabs)) first.
 */
export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkInitialRoute() {
      try {
        // 1. Check for incoming Google OAuth Callback (access_token or id_token)
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const hash = window.location.hash || "";
          const search = window.location.search || "";
          if (
            hash.includes("access_token") ||
            hash.includes("id_token") ||
            search.includes("access_token")
          ) {
            const googleUser = await parseGoogleAuthRedirect(hash || search);
            if (googleUser && isMounted) {
              await saveGoogleUserSession(googleUser, true);
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              router.replace("/(auth)/onboarding");
              return;
            }
          }
        } else {
          const initialUrl = await Linking.getInitialURL();
          if (
            initialUrl &&
            (initialUrl.includes("access_token") || initialUrl.includes("id_token"))
          ) {
            const googleUser = await parseGoogleAuthRedirect(initialUrl);
            if (googleUser && isMounted) {
              await saveGoogleUserSession(googleUser, true);
              router.replace("/(auth)/onboarding");
              return;
            }
          }
        }

        // 2. Check general authentication status
        const token = await storage.getItem("lumen_auth_token");
        const inOnboarding = await storage.getItem("lumen_in_onboarding");
        const webAuth =
          Platform.OS === "web" &&
          typeof localStorage !== "undefined" &&
          localStorage.getItem("lumen_authenticated") === "true";

        const isAuthenticated = token === "authenticated" || webAuth;

        if (!isMounted) return;

        if (isAuthenticated) {
          if (inOnboarding === "true") {
            router.replace("/(auth)/onboarding");
          } else {
            router.replace("/(tabs)");
          }
        } else {
          // First time opening app / logged out -> Open Cover Page first
          router.replace("/(auth)/welcome");
        }
      } catch (err) {
        if (!isMounted) return;
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
