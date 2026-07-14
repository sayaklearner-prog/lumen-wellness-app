import { useEffect, useState } from "react";
import { Platform } from "react-native";
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
    return window.location.origin;
  }
  return "https://lumen-wellness-app.onrender.com";
}

setBaseUrl(getBaseApiUrl());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
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

  const { data: profile, isLoading } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    }
  });

  useEffect(() => {
    async function checkAuth() {
      try {
        // Initialize offline queue listener (native only)
        if (Platform.OS !== "web") {
          const { setupOfflineSync } = require("@/services/sync");
          setupOfflineSync(() => {
            qc.invalidateQueries();
          });
        }

        const token = await storage.getItem("lumen_auth_token");
        const authenticated = token === "authenticated" ||
          (Platform.OS === "web" && typeof localStorage !== "undefined" && localStorage.getItem("lumen_authenticated") === "true");

        if (authenticated) {
          // Check biometrics (native only)
          if (Platform.OS !== "web") {
            const { getBiometricsEnabled, authenticateWithBiometrics } = require("@/services/security");
            const biometricsEnabled = await getBiometricsEnabled();
            if (biometricsEnabled) {
              const success = await authenticateWithBiometrics("Verify Identity to access your Health OS");
              if (!success) {
                alert("Biometric verification failed. Locked session.");
                setIsAuthenticated(false);
                return;
              }
            }
          }
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authChecked || isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onboardingComplete = (profile as any)?.onboardingComplete;

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace("/(auth)/welcome");
      }
    } else if (profile && onboardingComplete === false) {
      if (!(segments as any).includes("onboarding")) {
        router.replace("/(auth)/onboarding");
      }
    } else if (isAuthenticated && onboardingComplete !== false) {
      if (inAuthGroup) {
        router.replace("/(tabs)");
      }
    }
  }, [isAuthenticated, profile, authChecked, isLoading, segments]);

  if (!authChecked || (isAuthenticated && isLoading)) {
    return null;
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
