import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { storage } from "@/services/storage";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { GoogleIcon } from "@/components/GoogleIcon";
import {
  saveGoogleUserSession,
  getStoredGoogleUser,
  buildGoogleOAuthUrl,
  parseGoogleAuthRedirect,
  GoogleUser,
} from "@/services/googleAuth";
import { authService } from "@/services/authService";
import THEME from "@/constants/theme";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import {
  ArrowRight,
  ShieldCheck,
  Mail,
  CheckCircle2,
  X,
  User,
  KeyRound,
  RefreshCw,
  AlertCircle,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function WelcomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  // Mode: "signup" | "signin"
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [isLoading, setIsLoading] = useState(false);

  // Email OTP Manual Sign-Up / Sign-In Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpStage, setOtpStage] = useState<"enter_email" | "enter_otp" | "verified">("enter_email");
  const [otpCode, setOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpErrorMessage, setOtpErrorMessage] = useState("");
  const [devOtpNotification, setDevOtpNotification] = useState<string | null>(null);

  // Google OAuth Browser Redirect State
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  // Intercept Google OAuth redirect callback on page load or deep link return
  useEffect(() => {
    let isMounted = true;

    async function checkOAuthCallback() {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const hash = window.location.hash || "";
          const search = window.location.search || "";
          if (
            hash.includes("access_token") ||
            hash.includes("id_token") ||
            search.includes("access_token")
          ) {
            setIsSigningInGoogle(true);
            const user = await parseGoogleAuthRedirect(hash || search);
            if (user && isMounted) {
              await saveGoogleUserSession(user, true);
              qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
              if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
              router.replace("/(auth)/onboarding");
              return;
            }
            if (isMounted) setIsSigningInGoogle(false);
          }
        } else {
          const initialUrl = await Linking.getInitialURL();
          if (
            initialUrl &&
            (initialUrl.includes("access_token") || initialUrl.includes("id_token"))
          ) {
            setIsSigningInGoogle(true);
            const user = await parseGoogleAuthRedirect(initialUrl);
            if (user && isMounted) {
              await saveGoogleUserSession(user, true);
              qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
              router.replace("/(auth)/onboarding");
              return;
            }
            if (isMounted) setIsSigningInGoogle(false);
          }
        }
      } catch (err) {
        if (isMounted) setIsSigningInGoogle(false);
      }
    }

    checkOAuthCallback();

    const sub = Linking.addEventListener("url", async (event) => {
      if (event.url && (event.url.includes("access_token") || event.url.includes("id_token"))) {
        setIsSigningInGoogle(true);
        const user = await parseGoogleAuthRedirect(event.url);
        if (user && isMounted) {
          await saveGoogleUserSession(user, true);
          qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          router.replace("/(auth)/onboarding");
        }
        if (isMounted) setIsSigningInGoogle(false);
      }
    });

    // Native Android Capacitor Bridge Event Listener
    const handleNativeOAuthEvent = async (e: any) => {
      const url = e?.detail;
      if (url && (url.includes("access_token") || url.includes("id_token"))) {
        setIsSigningInGoogle(true);
        const user = await parseGoogleAuthRedirect(url);
        if (user && isMounted) {
          await saveGoogleUserSession(user, true);
          qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
          router.replace("/(auth)/onboarding");
        }
        if (isMounted) setIsSigningInGoogle(false);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("googleOAuthRedirect", handleNativeOAuthEvent);
    }

    return () => {
      isMounted = false;
      sub.remove();
      if (typeof window !== "undefined") {
        window.removeEventListener("googleOAuthRedirect", handleNativeOAuthEvent);
      }
    };
  }, [router, qc]);

  // When user taps "Connect with Google" on the Cover Page:
  // Redirect directly to the official Google OAuth login browser page (accounts.google.com)
  const handleGoogleAuthPress = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsSigningInGoogle(true);

    try {
      const authUrl = buildGoogleOAuthUrl();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        // Direct browser redirect to accounts.google.com
        window.location.href = authUrl;
      } else {
        // Open system browser on Android / iOS
        await Linking.openURL(authUrl);
      }
    } catch (err: any) {
      setIsSigningInGoogle(false);
      Alert.alert("Google Sign-In Error", "Could not open Google login page: " + err?.message);
    }
  };

  // Countdown timer for OTP expiry and resend cooldown
  useEffect(() => {
    let interval: any;
    if (showOtpModal && otpStage === "enter_otp") {
      interval = setInterval(() => {
        setOtpExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showOtpModal, otpStage]);

  // Open Email OTP Modal for Manual Sign Up
  const handleOpenManualSignUp = () => {
    triggerHaptic();
    setAuthMode("signup");
    setOtpEmail("");
    setOtpCode("");
    setOtpStage("enter_email");
    setOtpErrorMessage("");
    setDevOtpNotification(null);
    setShowOtpModal(true);
  };

  // Open Email OTP Modal for Sign In
  const handleOpenManualSignIn = () => {
    triggerHaptic();
    setAuthMode("signin");
    setOtpEmail("");
    setOtpCode("");
    setOtpStage("enter_email");
    setOtpErrorMessage("");
    setDevOtpNotification(null);
    setShowOtpModal(true);
  };

  // Request 6-digit OTP code to user's email
  const handleRequestOtp = async () => {
    triggerHaptic();
    setOtpErrorMessage("");
    const cleanEmail = otpEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setOtpErrorMessage("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setOtpErrorMessage("Please enter a valid email address (e.g., name@example.com).");
      return;
    }

    setOtpSending(true);
    try {
      const result = await authService.sendOtp(cleanEmail, authMode);
      if (result.success) {
        setOtpStage("enter_otp");
        setOtpExpiresIn(result.expiresInSeconds || 300);
        setResendCooldown(60);
        setOtpCode("");
        if (result.devOtp) {
          setDevOtpNotification(result.devOtp);
        }
      } else {
        setOtpErrorMessage(result.error || "Failed to dispatch verification code.");
      }
    } catch (err: any) {
      setOtpErrorMessage(err?.message || "Network error. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  // Verify user's 6-digit OTP
  const handleVerifyOtp = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setOtpErrorMessage("");
    const cleanCode = otpCode.trim();

    if (cleanCode.length !== 6) {
      setOtpErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setOtpVerifying(true);
    try {
      const result = await authService.verifyOtp(otpEmail, cleanCode, authMode);
      if (result.success && result.verified) {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
        setOtpStage("verified");

        setTimeout(async () => {
          setShowOtpModal(false);
          qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });

          if (authMode === "signup") {
            await storage.setItem("lumen_in_onboarding", "true");
            await storage.removeItem("lumen_onboarding_completed");
            if (Platform.OS === "web" && typeof localStorage !== "undefined") {
              localStorage.setItem("lumen_in_onboarding", "true");
              localStorage.removeItem("lumen_onboarding_completed");
            }
            router.replace("/(auth)/onboarding");
          } else {
            await storage.removeItem("lumen_in_onboarding");
            if (Platform.OS === "web" && typeof localStorage !== "undefined") {
              localStorage.removeItem("lumen_in_onboarding");
            }
            router.replace("/(tabs)");
          }
        }, 1200);
      } else {
        setOtpErrorMessage(result.error || "Invalid verification code.");
      }
    } catch (err: any) {
      setOtpErrorMessage(err?.message || "Verification failed. Please try again.");
    } finally {
      setOtpVerifying(false);
    }
  };

  // Guest bypass fallback
  const handleGuestBypass = async () => {
    triggerHaptic();
    await storage.setItem("lumen_auth_token", "authenticated");
    await storage.removeItem("lumen_in_onboarding");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_authenticated", "true");
      localStorage.removeItem("lumen_in_onboarding");
    }
    qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      {/* ========================================================= */}
      {/* FULLSCREEN BACKGROUND PHOTOGRAPHY (Reference Aesthetic)    */}
      {/* ========================================================= */}
      <Image
        source={require("../../assets/cover-bg.jpg")}
        style={styles.coverImageBg}
        resizeMode="cover"
      />

      {/* Cinematic Dual Vignette Overlays for Maximum Legibility */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Defs>
          {/* Vertical sunset-to-night gradient vignette */}
          <LinearGradient id="heroVerticalVignette" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#080e0b" stopOpacity="0.40" />
            <Stop offset="30%" stopColor="#080e0b" stopOpacity="0.08" />
            <Stop offset="65%" stopColor="#080e0b" stopOpacity="0.32" />
            <Stop offset="100%" stopColor="#080e0b" stopOpacity="0.92" />
          </LinearGradient>
          {/* Left-edge shadow to give typography razor-sharp contrast */}
          <LinearGradient id="heroLeftEdgeVignette" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#080e0b" stopOpacity="0.65" />
            <Stop offset="55%" stopColor="#080e0b" stopOpacity="0.20" />
            <Stop offset="100%" stopColor="#080e0b" stopOpacity="0.0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroVerticalVignette)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroLeftEdgeVignette)" />
      </Svg>

      {/* Main Foreground Content */}
      <View style={styles.content}>
        {/* Top Minimalist Luxury Header */}
        <View style={styles.topHeader}>
          <View style={styles.brandTitleRow}>
            <Text style={styles.luxuryBrandTitle}>l u m e n</Text>
            <View style={styles.brandDot} />
          </View>
          <Pressable
            style={styles.menuTriggerBtn}
            onPress={handleOpenManualSignIn}
            accessibilityLabel="Open Menu"
          >
            <View style={styles.menuTriggerBar1} />
            <View style={styles.menuTriggerBar2} />
          </Pressable>
        </View>

        {/* Center/Left Hero Headline & Action Buttons */}
        <View style={styles.heroTextContainer}>
          <Text style={styles.heroHeadline}>
            A{"\n"}Healthier{"\n"}Happier{"\n"}You.
          </Text>
          <Text style={styles.heroSubheadline}>
            Small steps.{"\n"}Big changes.
          </Text>

          {/* Action Buttons: Google Connect above Get Started */}
          <View style={styles.actionsColumn}>
            {/* 1-Tap Google Connect Button */}
            <Pressable
              style={({ pressed }) => [
                styles.coverGoogleBtn,
                pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => {
                triggerHaptic();
                handleGoogleAuthPress();
              }}
              disabled={isLoading}
            >
              <GoogleIcon size={18} />
              <Text style={styles.coverGoogleBtnText}>Connect with Google</Text>
            </Pressable>

            {/* Iconic Frosted Champagne "Get Started ->" Action Pill */}
            <Pressable
              style={({ pressed }) => [
                styles.getStartedPill,
                pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => {
                triggerHaptic();
                setAuthMode("signup");
                setShowOtpModal(true);
              }}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <View style={styles.arrowCircle}>
                <ArrowRight size={18} color="#ffffff" strokeWidth={2.6} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Bottom Section: Frosted Brand Pill & 4 Wellness Pillars */}
        <View style={styles.bottomSection}>
          {/* Left: Frosted Luxury Brand Tag Pill */}
          <Pressable
            style={({ pressed }) => [
              styles.frostedBrandTagPill,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              triggerHaptic();
              setAuthMode("signup");
              setShowOtpModal(true);
            }}
          >
            <View style={styles.brandTagDot} />
            <Text style={styles.brandTagText} numberOfLines={1}>
              Lumen OS • Advanced Bio-Intelligence
            </Text>
          </Pressable>

          {/* Right: Vertical Line + 4 Wellness Pillars */}
          <View style={styles.pillarsCol}>
            <View style={styles.pillarsDivider} />
            <View style={styles.pillarsList}>
              <Text style={styles.pillarItem}>Move</Text>
              <Text style={styles.pillarItem}>Nourish</Text>
              <Text style={styles.pillarItem}>Mind</Text>
              <Text style={styles.pillarItem}>Thrive</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ========================================================= */}
      {/* REDESIGNED LUXURY EMAIL VERIFICATION POP-UP                */}
      {/* ========================================================= */}
      <Modal
        visible={showOtpModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOtpModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowOtpModal(false)} />
          <View style={styles.modalPanel}>
            {/* Top Handle */}
            <View style={styles.modalHandle} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* TWO SECTIONS: Sign Up vs Already Signed Up (Member Sign In) */}
              <View style={styles.authModeSegment}>
                <Pressable
                  style={[
                    styles.segmentTab,
                    authMode === "signup" && styles.segmentTabActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setAuthMode("signup");
                    if (otpErrorMessage) setOtpErrorMessage("");
                  }}
                >
                  <Sparkles size={13} color={authMode === "signup" ? "#0b1612" : "#9cb6ae"} />
                  <Text
                    style={[
                      styles.segmentTabText,
                      authMode === "signup" && styles.segmentTabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    Sign Up
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.segmentTab,
                    authMode === "signin" && styles.segmentTabActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setAuthMode("signin");
                    if (otpErrorMessage) setOtpErrorMessage("");
                  }}
                >
                  <KeyRound size={13} color={authMode === "signin" ? "#0b1612" : "#9cb6ae"} />
                  <Text
                    style={[
                      styles.segmentTabText,
                      authMode === "signin" && styles.segmentTabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    Sign In
                  </Text>
                </Pressable>
              </View>

              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 }}>
                  <View style={styles.modalIconGlowCircle}>
                    <Mail size={20} color="#f5ede4" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                      {authMode === "signup" ? "Create Account" : "Welcome Back"}
                    </Text>
                    <Text style={styles.modalHeaderSub} numberOfLines={1}>
                      {otpStage === "enter_email"
                        ? "Enter email to receive your 6-digit code"
                        : otpStage === "enter_otp"
                        ? "Enter the 6-digit verification code"
                        : "Verification Confirmed"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setShowOtpModal(false)}
                  disabled={otpSending || otpVerifying}
                >
                  <X size={16} color="#ffffff" strokeWidth={2.5} />
                </Pressable>
              </View>

            {/* Error Banner if any */}
            {otpErrorMessage ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={15} color="#ef4444" />
                <Text style={styles.errorBannerText}>{otpErrorMessage}</Text>
              </View>
            ) : null}

            {/* Dev Notification / Preview Hint if available */}
            {devOtpNotification && otpStage === "enter_otp" ? (
              <Pressable
                style={styles.devBanner}
                onPress={() => {
                  setOtpCode(devOtpNotification);
                  triggerHaptic();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.devBannerTitle}>Development Preview Code</Text>
                  <Text style={styles.devBannerBody}>
                    Tap to auto-fill code:{" "}
                    <Text style={{ fontWeight: "900", color: "#10b981" }}>{devOtpNotification}</Text>
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {/* STAGE 1: ENTER EMAIL & 1-CLICK OPTIONS */}
            {otpStage === "enter_email" && (
              <View style={{ gap: 14 }}>
                {/* 1-Click Google Access */}
                <Pressable
                  style={styles.modalGoogleBtn}
                  onPress={handleGoogleAuthPress}
                  disabled={isLoading}
                >
                  <GoogleIcon size={20} />
                  <Text style={styles.modalGoogleBtnText}>
                    {authMode === "signup" ? "Continue with Google" : "Sign In with Google"}
                  </Text>
                </Pressable>

                {/* Aesthetic Divider */}
                <View style={styles.modalDividerRow}>
                  <View style={styles.modalDividerLine} />
                  <Text style={styles.modalDividerText}>OR WITH EMAIL</Text>
                  <View style={styles.modalDividerLine} />
                </View>

                {/* Email Input Field */}
                <View style={styles.modalInputBox}>
                  <Mail size={18} color="#10b981" />
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="Enter your email"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={otpEmail}
                    onChangeText={(t) => {
                      setOtpEmail(t);
                      if (otpErrorMessage) setOtpErrorMessage("");
                    }}
                    onSubmitEditing={handleRequestOtp}
                  />
                </View>

                {/* Security Tag */}
                <View style={styles.securityRow}>
                  <Lock size={12} color="#10b981" />
                  <Text style={styles.securityText}>
                    Passwordless secure login. We'll send a 6-digit confirmation code.
                  </Text>
                </View>

                {/* Send Button */}
                <Pressable
                  style={[styles.modalActionPillBtn, otpSending && { opacity: 0.7 }]}
                  onPress={handleRequestOtp}
                  disabled={otpSending}
                >
                  {otpSending ? (
                    <ActivityIndicator size="small" color="#161b18" />
                  ) : (
                    <>
                      <Text style={styles.modalActionPillText}>
                        {authMode === "signup" ? "Send Sign Up Code" : "Send Login Code"}
                      </Text>
                      <ArrowRight size={18} color="#161b18" strokeWidth={2.4} />
                    </>
                  )}
                </Pressable>

                {/* Switch Section Link */}
                <Pressable
                  style={styles.switchSectionBtn}
                  onPress={() => {
                    triggerHaptic();
                    setAuthMode(authMode === "signup" ? "signin" : "signup");
                    if (otpErrorMessage) setOtpErrorMessage("");
                  }}
                >
                  <Text style={styles.switchSectionPrompt}>
                    {authMode === "signup" ? "Already have an account? " : "New to Lumen? "}
                    <Text style={styles.switchSectionLink}>
                      {authMode === "signup" ? "Member Sign In" : "Create Account"}
                    </Text>
                  </Text>
                </Pressable>

                {/* Guest Offline Link */}
                <Pressable style={styles.guestLinkBox} onPress={handleGuestBypass}>
                  <Text style={styles.guestLinkText}>Explore as Guest / Offline</Text>
                </Pressable>
              </View>
            )}

            {/* STAGE 2: ENTER 6-DIGIT OTP CODE */}
            {otpStage === "enter_otp" && (
              <View style={{ gap: 16 }}>
                {/* Active Target Email Notice */}
                <View style={styles.targetEmailRow}>
                  <Text style={styles.targetEmailText} numberOfLines={1}>
                    Code sent to <Text style={{ color: "#ffffff", fontWeight: "800" }}>{otpEmail}</Text>
                  </Text>
                  <Pressable
                    onPress={() => {
                      setOtpStage("enter_email");
                      setOtpErrorMessage("");
                    }}
                  >
                    <Text style={styles.changeEmailLink}>Edit</Text>
                  </Pressable>
                </View>

                {/* Big 6-Digit OTP Code Input */}
                <View style={styles.otpCardBox}>
                  <View style={styles.otpHeaderRow}>
                    <Text style={styles.otpHeaderLabel}>6-DIGIT VERIFICATION CODE</Text>
                    <Text style={styles.expiryTimerText}>
                      Expires in {Math.floor(otpExpiresIn / 60)}:{(otpExpiresIn % 60).toString().padStart(2, "0")}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.otpCodeInput}
                    placeholder="• • • • • •"
                    placeholderTextColor="rgba(255, 255, 255, 0.25)"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={(val) => {
                      const clean = val.replace(/[^0-9]/g, "");
                      setOtpCode(clean);
                      if (otpErrorMessage) setOtpErrorMessage("");
                    }}
                    autoFocus
                  />
                </View>

                {/* Resend actions */}
                <View style={styles.resendRow}>
                  <Text style={styles.resendPrompt}>Didn't receive code?</Text>
                  {resendCooldown > 0 ? (
                    <Text style={styles.resendCooldownText}>Resend in {resendCooldown}s</Text>
                  ) : (
                    <Pressable onPress={handleRequestOtp} disabled={otpSending}>
                      <Text style={styles.resendActionLink}>Resend Code</Text>
                    </Pressable>
                  )}
                </View>

                {/* Verify Button */}
                <Pressable
                  style={[
                    styles.verifyActionBtn,
                    (otpCode.length !== 6 || otpVerifying) && { opacity: otpCode.length === 6 ? 0.7 : 0.5 },
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpCode.length !== 6 || otpVerifying}
                >
                  {otpVerifying ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <ShieldCheck size={18} color="#ffffff" strokeWidth={2.4} />
                      <Text style={styles.verifyActionText}>Verify & Continue</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* STAGE 3: VERIFIED CELEBRATION */}
            {otpStage === "verified" && (
              <View style={styles.verifiedContainer}>
                <View style={styles.verifiedIconBadge}>
                  <CheckCircle2 size={44} color="#10b981" />
                </View>
                <Text style={styles.verifiedTitle}>Verification Confirmed</Text>
                <Text style={styles.verifiedSub}>
                  Preparing your personalized biometric environment...
                </Text>
              </View>
            )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* GOOGLE BROWSER AUTHENTICATION OVERLAY                     */}
      {/* ========================================================= */}
      {isSigningInGoogle && (
        <View style={styles.googleRedirectOverlay}>
          <View style={styles.googleRedirectBox}>
            <ActivityIndicator size="large" color="#4285f4" />
            <Text style={styles.googleRedirectTitle}>Connecting to Google...</Text>
            <Text style={styles.googleRedirectSub}>
              Opening official accounts.google.com in browser
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080e0b",
  },
  coverImageBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    paddingBottom: Platform.OS === "ios" ? 38 : 22,
    justifyContent: "space-between",
  },

  // Top Minimalist Luxury Header
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  luxuryBrandTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 6,
    textTransform: "uppercase",
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  menuTriggerBtn: {
    width: 36,
    height: 36,
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 5,
  },
  menuTriggerBar1: {
    width: 22,
    height: 2,
    backgroundColor: "#ffffff",
    borderRadius: 1,
  },
  menuTriggerBar2: {
    width: 15,
    height: 2,
    backgroundColor: "#ffffff",
    borderRadius: 1,
  },

  // Hero Headline & Action Buttons
  heroTextContainer: {
    marginTop: "auto",
    marginBottom: "auto",
    paddingVertical: 14,
    width: "100%",
    paddingRight: 10,
  },
  heroHeadline: {
    fontSize: 38,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 42,
    letterSpacing: -1.0,
  },
  heroSubheadline: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.90)",
    lineHeight: 22,
    marginTop: 10,
  },

  actionsColumn: {
    gap: 12,
    marginTop: 20,
  },

  // 1-Tap Google Connect Button on Cover Page
  coverGoogleBtn: {
    height: 46,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 23,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  coverGoogleBtnText: {
    color: "#0b1612",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // Iconic Frosted Champagne Action Pill from Reference
  getStartedPill: {
    backgroundColor: "#f5ede4",
    borderRadius: 34,
    paddingVertical: 6,
    paddingLeft: 22,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  getStartedText: {
    color: "#161b18",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  arrowCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#161b18",
    alignItems: "center",
    justifyContent: "center",
  },

  // Bottom Section: Frosted Brand Tag & Pillars
  bottomSection: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 4,
    gap: 12,
  },
  frostedBrandTagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "68%",
  },
  brandTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  brandTagText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  pillarsCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  pillarsDivider: {
    width: 1,
    height: 62,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    marginRight: 12,
  },
  pillarsList: {
    gap: 3,
  },
  pillarItem: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },

  // Modal Backdrop & Luxury Panel
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 14, 11, 0.72)",
    justifyContent: "flex-end",
  },
  modalPanel: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: "rgba(14, 25, 20, 0.98)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
    overflow: "hidden",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    alignSelf: "center",
    marginBottom: 8,
  },
  modalScrollContent: {
    gap: 14,
    paddingBottom: 12,
  },

  // Two Section Switcher: Sign Up vs Already Signed Up
  authModeSegment: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 22,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 18,
    gap: 6,
  },
  segmentTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#a3c2b6",
  },
  segmentTabTextActive: {
    color: "#0b1612",
    fontWeight: "900",
  },

  switchSectionBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  switchSectionPrompt: {
    color: "#b4cbbf",
    fontSize: 12,
    fontWeight: "600",
  },
  switchSectionLink: {
    color: "#10b981",
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalIconGlowCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(245, 237, 228, 0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(245, 237, 228, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  modalHeaderSub: {
    fontSize: 12,
    color: "#b4cbbf",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Google 1-Click Fast Button
  modalGoogleBtn: {
    height: 52,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalGoogleBtnText: {
    color: "#0b1612",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  modalDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 2,
  },
  modalDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  modalDividerText: {
    color: "#8fae9f",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // Input Box
  modalInputBox: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(215, 230, 224, 0.85)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0b1612",
  },

  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  securityText: {
    color: "#b4cbbf",
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },

  modalActionPillBtn: {
    height: 54,
    backgroundColor: "#f5ede4",
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginTop: 4,
  },
  modalActionPillText: {
    color: "#161b18",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  guestLinkBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  guestLinkText: {
    color: "#b4cbbf",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // OTP Stage
  targetEmailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  targetEmailText: {
    color: "#dbeae3",
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  changeEmailLink: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "800",
  },

  otpCardBox: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.45)",
    gap: 8,
  },
  otpHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  otpHeaderLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 0.8,
  },
  expiryTimerText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },
  otpCodeInput: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 10,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  resendPrompt: {
    color: "#b4cbbf",
    fontSize: 12,
  },
  resendCooldownText: {
    color: "#8fae9f",
    fontSize: 12,
    fontWeight: "700",
  },
  resendActionLink: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "800",
  },

  verifyActionBtn: {
    height: 54,
    backgroundColor: "#10b981",
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  verifyActionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  // Verified Celebration
  verifiedContainer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  verifiedIconBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
  },
  verifiedSub: {
    fontSize: 13,
    color: "#b4cbbf",
    textAlign: "center",
  },

  // Banners
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  errorBannerText: {
    color: "#fca5a5",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  devBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  devBannerTitle: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },
  devBannerBody: {
    color: "#dbeae3",
    fontSize: 12,
    marginTop: 2,
  },

  // Google Account Chooser Styles
  googleChooserPanel: {
    backgroundColor: "#111c16",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 40 : 26,
  },
  googleChooserHeader: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  googleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  googleChooserTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  googleChooserSub: {
    fontSize: 13,
    color: "#8ea69b",
    marginTop: 2,
    fontWeight: "600",
  },
  googleChooserCloseBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  googleSigningInBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleSigningInTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
  },
  googleSigningInAccount: {
    color: "#d4f933",
    fontSize: 13,
    fontWeight: "700",
  },
  googleSigningInSub: {
    color: "#8ea69b",
    fontSize: 12,
    marginTop: 4,
  },
  googleAccountsList: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  googleAccountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  googleAccountRowPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  googleAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  googleAvatarInitial: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  googleAccountInfoCol: {
    flex: 1,
  },
  googleAccountName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  googleAccountEmail: {
    color: "#8ea69b",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },
  googleAddAccountRow: {
    borderBottomWidth: 0,
  },
  googleAddAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  googleAddAccountText: {
    color: "#c2d4cb",
    fontSize: 13,
    fontWeight: "700",
  },
  googleChooserDisclaimer: {
    color: "#6b8377",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    paddingHorizontal: 8,
    marginTop: 4,
  },
  googleInputSectionTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  googleCancelAddBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  googleCancelAddBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  googleConfirmAddBtn: {
    flex: 2,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#d4f933",
    alignItems: "center",
    justifyContent: "center",
  },
  googleConfirmAddBtnText: {
    color: "#0b120f",
    fontSize: 14,
    fontWeight: "900",
  },
  googleRedirectOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  googleRedirectBox: {
    backgroundColor: "#0d1b15",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(66, 133, 244, 0.4)",
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    maxWidth: 320,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  googleRedirectTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 16,
    textAlign: "center",
  },
  googleRedirectSub: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 17,
  },
});
