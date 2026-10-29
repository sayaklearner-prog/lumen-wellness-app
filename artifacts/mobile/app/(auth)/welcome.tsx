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
  isGoogleOAuthConfigured,
  buildGoogleAuthUrl,
  fetchGoogleUserInfo,
  parseOAuthRedirectUrl,
  saveGoogleUserSession,
  getStoredGoogleUser,
  GoogleUser,
} from "@/services/googleAuth";
import { authService } from "@/services/authService";
import THEME from "@/constants/theme";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { LiveBioCore3D } from "@/components/LiveBioCore3D";
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

  // Google Sign-In Interactive Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [gmailAddress, setGmailAddress] = useState("");
  const [gmailName, setGmailName] = useState("");
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [savedUserPreview, setSavedUserPreview] = useState<GoogleUser | null>(null);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  // Check for existing signed-in Google user preview
  useEffect(() => {
    async function checkSaved() {
      const u = await getStoredGoogleUser();
      if (u) {
        setSavedUserPreview(u);
        if (!gmailAddress) setGmailAddress(u.email);
        if (!gmailName) setGmailName(u.name);
      }
    }
    checkSaved();
  }, []);

  // Listen to incoming OAuth redirect URLs
  useEffect(() => {
    const handleUrlEvent = async (event: { url: string }) => {
      const { url } = event;
      if (!url) return;

      const { accessToken, idToken, error } = parseOAuthRedirectUrl(url);

      if (error) {
        Alert.alert("Google Sign-In Error", `Authentication failed: ${error}`);
        setIsLoading(false);
        return;
      }

      if (accessToken) {
        setIsLoading(true);
        try {
          const profile = await fetchGoogleUserInfo(accessToken);
          if (profile && profile.email) {
            const googleUser: GoogleUser = {
              id: profile.id || `google-${Date.now()}`,
              email: profile.email,
              name: profile.name || "User",
              givenName: profile.givenName,
              familyName: profile.familyName,
              photoUrl: profile.photoUrl,
              accessToken,
              idToken,
              provider: "google",
              signedInAt: new Date().toISOString(),
            };

            const isSignUp = authMode === "signup";
            await saveGoogleUserSession(googleUser, isSignUp);
            qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });

            if (isSignUp) {
              router.replace("/(auth)/onboarding");
            } else {
              router.replace("/(tabs)");
            }
          }
        } catch (err: any) {
          Alert.alert("Authentication", "Failed to retrieve Google profile: " + err?.message);
        } finally {
          setIsLoading(false);
        }
      }
    };

    const sub = Linking.addEventListener("url", handleUrlEvent);

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        handleUrlEvent({ url: initialUrl });
      }
    });

    return () => sub.remove();
  }, [authMode]);

  // Primary Google / Gmail action handler
  const handleGoogleAuthPress = async () => {
    triggerHaptic();

    if (isGoogleOAuthConfigured()) {
      setIsLoading(true);
      const authUrl = buildGoogleAuthUrl(authMode === "signup" ? "select_account" : "consent");
      try {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.href = authUrl;
        } else {
          await Linking.openURL(authUrl);
        }
      } catch (err: any) {
        setIsLoading(false);
        Alert.alert("OAuth Error", "Unable to launch Google browser sign-in: " + err?.message);
      }
      return;
    }

    setShowGoogleModal(true);
  };

  // Complete Google Sign-In / Sign-Up from Google Account Dialog
  const handleCompleteGoogleModal = async (selectedEmail?: string, selectedName?: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const emailToUse = (selectedEmail || gmailAddress).trim();
    const nameToUse = (selectedName || gmailName).trim();

    if (!emailToUse) {
      Alert.alert("Gmail Required", "Please enter your Gmail address to continue.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      Alert.alert("Invalid Email", "Please enter a valid email address (e.g., name@gmail.com).");
      return;
    }

    setModalSubmitting(true);
    try {
      const googleUser: GoogleUser = {
        id: `google-${Date.now()}`,
        email: emailToUse,
        name: nameToUse || emailToUse.split("@")[0] || "User",
        provider: "google",
        signedInAt: new Date().toISOString(),
      };

      const isSignUp = authMode === "signup";
      await saveGoogleUserSession(googleUser, isSignUp);

      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      setShowGoogleModal(false);

      if (isSignUp) {
        router.replace("/(auth)/onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      Alert.alert("Sign In Error", "Failed to complete Google login: " + err?.message);
    } finally {
      setModalSubmitting(false);
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

        {/* Bottom Section: 3D Living Bio-Core Animation & 4 Wellness Pillars */}
        <View style={styles.bottomSection}>
          {/* Left: Unique 3D Living Bio-Core Animation (replaces Join 50K) */}
          <LiveBioCore3D
            onPress={() => {
              triggerHaptic();
              setAuthMode("signup");
              setShowOtpModal(true);
            }}
          />

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
                  <Sparkles size={14} color={authMode === "signup" ? "#0b1612" : "#9cb6ae"} />
                  <Text
                    style={[
                      styles.segmentTabText,
                      authMode === "signup" && styles.segmentTabTextActive,
                    ]}
                  >
                    New Member (Sign Up)
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
                  <KeyRound size={14} color={authMode === "signin" ? "#0b1612" : "#9cb6ae"} />
                  <Text
                    style={[
                      styles.segmentTabText,
                      authMode === "signin" && styles.segmentTabTextActive,
                    ]}
                  >
                    Already Member (Sign In)
                  </Text>
                </Pressable>
              </View>

              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={styles.modalIconGlowCircle}>
                    <Mail size={22} color="#f5ede4" strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalHeaderTitle}>
                      {authMode === "signup" ? "Create Your Account" : "Welcome Back"}
                    </Text>
                    <Text style={styles.modalHeaderSub}>
                      {otpStage === "enter_email"
                        ? authMode === "signup"
                          ? "Step 1 of 2: Confirm email to begin your bio-journey"
                          : "Step 1 of 2: Enter registered email to access vitals"
                        : otpStage === "enter_otp"
                        ? "Step 2 of 2: Enter 6-digit verification code"
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
                    placeholder="Enter your email (e.g. name@example.com)"
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
                  <Text style={styles.targetEmailText}>
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
      {/* GOOGLE ACCOUNT AUTHENTICATION MODAL                        */}
      {/* ========================================================= */}
      <Modal
        visible={showGoogleModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGoogleModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowGoogleModal(false)} />
          <View style={styles.modalPanel}>
            <View style={styles.modalHandle} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <GoogleIcon size={24} />
                  <View>
                    <Text style={styles.modalHeaderTitle}>
                      {authMode === "signup" ? "Sign Up with Google" : "Sign In with Google"}
                    </Text>
                    <Text style={styles.modalHeaderSub}>Direct Google Identity Platform</Text>
                  </View>
                </View>
                <Pressable style={styles.modalCloseBtn} onPress={() => setShowGoogleModal(false)}>
                  <X size={16} color="#ffffff" />
                </Pressable>
              </View>

              {savedUserPreview && (
                <Pressable
                  style={styles.savedAccountCard}
                  onPress={() => handleCompleteGoogleModal(savedUserPreview.email, savedUserPreview.name)}
                >
                  <View style={styles.savedAvatar}>
                    <Text style={styles.savedAvatarText}>
                      {(savedUserPreview.name || savedUserPreview.email)[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedName}>{savedUserPreview.name}</Text>
                    <Text style={styles.savedEmail}>{savedUserPreview.email}</Text>
                  </View>
                  <CheckCircle2 size={18} color="#10b981" />
                </Pressable>
              )}

              <View style={styles.modalInputBox}>
                <User size={18} color="#10b981" />
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Full Name (e.g., Alex Rivera)"
                  placeholderTextColor="#64748b"
                  value={gmailName}
                  onChangeText={setGmailName}
                />
              </View>

              <View style={[styles.modalInputBox, { marginTop: 4 }]}>
                <Mail size={18} color="#10b981" />
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Gmail address (e.g., alex@gmail.com)"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={gmailAddress}
                  onChangeText={setGmailAddress}
                />
              </View>

              <Pressable
                style={styles.googleSubmitBtn}
                onPress={() => handleCompleteGoogleModal()}
                disabled={modalSubmitting}
              >
                {modalSubmitting ? (
                  <ActivityIndicator size="small" color="#0b1612" />
                ) : (
                  <>
                    <GoogleIcon size={18} />
                    <Text style={styles.googleSubmitBtnText}>Continue with Account</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    maxWidth: "80%",
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

  // Bottom Section: 3D Bio-Core & Pillars
  bottomSection: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 4,
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
    maxHeight: "88%",
    backgroundColor: "rgba(14, 25, 20, 0.98)",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
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

  // Google Modal specific styles
  savedAccountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  savedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedAvatarText: {
    color: "#10b981",
    fontSize: 16,
    fontWeight: "800",
  },
  savedName: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  savedEmail: {
    color: "#b4cbbf",
    fontSize: 11,
  },
  googleSubmitBtn: {
    height: 52,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  googleSubmitBtnText: {
    color: "#0b1612",
    fontSize: 15,
    fontWeight: "800",
  },
});
