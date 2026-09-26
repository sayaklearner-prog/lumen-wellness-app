import { useEffect, useState } from "react";
import { Platform, View, Text, ActivityIndicator } from "react-native";
import { Stack, Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetMyProfile, getGetMyProfileQueryKey, setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";

// Resolve backend API URL
function getBaseApiUrl() {
  if (typeof window !== "undefined") {
    // browser environments
    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }
    // When running on Render web service directly, use window.location.origin
    if (window.location.hostname.includes("onrender.com")) {
      return window.location.origin;
    }
    // When running on Vercel, localhost, or any other web host, connect to Render backend
    return "https://lumen-wellness-app.onrender.com";
  }
  return "https://lumen-wellness-app.onrender.com";
}

setBaseUrl(getBaseApiUrl());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const qc = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Synchronize and verify auth state from storage
  const verifyAuth = async (): Promise<boolean> => {
    try {
      const token = await storage.getItem("lumen_auth_token");
      const webAuth = Platform.OS === "web" && typeof localStorage !== "undefined" && localStorage.getItem("lumen_authenticated") === "true";
      const authenticated = token === "authenticated" || webAuth;

      setIsAuthenticated(authenticated);
      return authenticated;
    } catch {
      setIsAuthenticated(false);
      return false;
    } finally {
      setAuthChecked(true);
    }
  };

  const { data: profile, isLoading } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: isAuthenticated,
      retry: 2,
    }
  });

  // Run on initial mount (with offline sync setup)
  useEffect(() => {
    if (Platform.OS !== "web") {
      try {
        const { setupOfflineSync } = require("@/services/sync");
        setupOfflineSync(() => {
          qc.invalidateQueries();
        });
      } catch {}
    }
    verifyAuth();
  }, []);

  // Run navigation evaluation whenever route segments or profile change
  useEffect(() => {
    async function evaluateNavigation() {
      const authenticated = await verifyAuth();

      if (isLoading) return;

      const inAuthGroup = segments[0] === "(auth)";
      const localOnboardingDone =
        (Platform.OS === "web" && typeof localStorage !== "undefined" && localStorage.getItem("lumen_onboarding_completed") === "true") ||
        (await storage.getItem("lumen_onboarding_completed")) === "true";

      const onboardingComplete = (profile as any)?.onboardingComplete ?? (localOnboardingDone ? true : undefined);

      if (!authenticated) {
        if (!inAuthGroup) {
          router.replace("/(auth)/welcome");
        }
      } else {
        // User is authenticated
        if (onboardingComplete === false && !localOnboardingDone) {
          if (!(segments as any).includes("onboarding")) {
            router.replace("/(auth)/onboarding");
          }
        } else {
          // Onboarding completed or in progress
          if (inAuthGroup) {
            router.replace("/(tabs)");
          }
        }
      }
    }

    evaluateNavigation();
  }, [segments, profile, isLoading]);

  const [loadingTimedOut, setLoadingTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoadingTimedOut(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!authChecked || (isAuthenticated && isLoading && !loadingTimedOut)) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050b08", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#10b981", fontSize: 26, fontWeight: "900", letterSpacing: 1.5, marginBottom: 12 }}>
          LUMEN OS
        </Text>
        <ActivityIndicator size="small" color="#10b981" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
