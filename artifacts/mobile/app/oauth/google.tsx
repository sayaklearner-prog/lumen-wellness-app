import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { GoogleIcon } from "@/components/GoogleIcon";
import {
  parseOAuthRedirectUrl,
  fetchGoogleUserInfo,
  saveGoogleUserSession,
  GoogleUser,
} from "@/services/googleAuth";
import { CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react-native";

export default function GoogleOAuthCallback() {
  const router = useRouter();
  const qc = useQueryClient();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function processOAuthCallback() {
      try {
        let currentUrl = "";
        if (Platform.OS === "web" && typeof window !== "undefined") {
          currentUrl = window.location.href;
        }

        const { accessToken, idToken, error } = parseOAuthRedirectUrl(currentUrl);

        if (error) {
          setStatus("error");
          setErrorMessage(
            error === "access_denied"
              ? "Google Sign-In was cancelled."
              : `Google authentication returned: ${error}`
          );
          return;
        }

        if (!accessToken) {
          // If no token was found directly in currentUrl, allow a brief delay in case of hash parsing
          setStatus("error");
          setErrorMessage("No authorization token received from Google.");
          return;
        }

        // Fetch user profile from official Google userinfo endpoint
        const profile = await fetchGoogleUserInfo(accessToken);
        if (!profile || !profile.email) {
          setStatus("error");
          setErrorMessage("Failed to retrieve Google profile information.");
          return;
        }

        const googleUser: GoogleUser = {
          id: profile.id || `google-${Date.now()}`,
          email: profile.email,
          name: profile.name || profile.givenName || "User",
          givenName: profile.givenName,
          familyName: profile.familyName,
          photoUrl: profile.photoUrl,
          accessToken,
          idToken,
          provider: "google",
          signedInAt: new Date().toISOString(),
        };

        setUserName(googleUser.name);
        // Persist session & flag onboarding
        await saveGoogleUserSession(googleUser, true);
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });

        setStatus("success");

        // Per user selection: Automatically navigate directly to Personal Details (Step 1 of Onboarding)
        setTimeout(() => {
          router.replace("/(auth)/onboarding");
        }, 800);
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err?.message || "An unexpected error occurred during Google Sign-In.");
      }
    }

    processOAuthCallback();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          <GoogleIcon size={36} />
        </View>

        {status === "loading" && (
          <View style={styles.stateBox}>
            <Text style={styles.title}>Connecting Google Account</Text>
            <Text style={styles.sub}>
              Verifying your Google identity and preparing your biometrics...
            </Text>
            <ActivityIndicator size="large" color="#d4f933" style={{ marginTop: 16 }} />
          </View>
        )}

        {status === "success" && (
          <View style={styles.stateBox}>
            <View style={styles.successBadge}>
              <CheckCircle2 size={32} color="#10b981" />
            </View>
            <Text style={styles.title}>Welcome, {userName}!</Text>
            <Text style={styles.sub}>Opening Personal Details setup...</Text>
          </View>
        )}

        {status === "error" && (
          <View style={styles.stateBox}>
            <View style={styles.errorBadge}>
              <AlertCircle size={32} color="#ef4444" />
            </View>
            <Text style={styles.title}>Google Sign-In</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => router.replace("/(auth)/welcome")}
            >
              <ArrowLeft size={16} color="#0b120f" strokeWidth={2.4} />
              <Text style={styles.retryBtnText}>Back to Welcome</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b120f",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#131e18",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  stateBox: {
    alignItems: "center",
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 8,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8ea69b",
    textAlign: "center",
  },
  successBadge: {
    marginBottom: 12,
  },
  errorBadge: {
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: "#fca5a5",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#d4f933",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryBtnText: {
    color: "#0b120f",
    fontSize: 14,
    fontWeight: "800",
  },
});
