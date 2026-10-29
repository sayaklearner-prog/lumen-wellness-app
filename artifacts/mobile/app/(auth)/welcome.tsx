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
import { AmbientAtmosphere } from "@/components/AmbientAtmosphere";
import Svg, { Circle, Path as SvgPath, Defs, RadialGradient as SvgRadialGrad, Stop as SvgStop } from "react-native-svg";
import {
  Sparkles,
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
  Play,
} from "lucide-react-native";

const { width } = Dimensions.get("window");

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

  // Google Sign-In Interactive Modal State (used when OAuth key is pending or for direct account selection)
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

  // Listen to incoming OAuth redirect URLs (from real Google OAuth flow)
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

    // Also check initial URL if opened via deep link
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

    // If real Google OAuth Client ID has been configured, trigger the browser OAuth flow
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

    // When OAuth key is pending, open the interactive Google Account Selector
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

    // Validate email format
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
            // First email verification done! Now transition to other onboarding inputs
            await storage.setItem("lumen_in_onboarding", "true");
            await storage.removeItem("lumen_onboarding_completed");
            if (Platform.OS === "web" && typeof localStorage !== "undefined") {
              localStorage.setItem("lumen_in_onboarding", "true");
              localStorage.removeItem("lumen_onboarding_completed");
            }
            router.replace("/(auth)/onboarding");
          } else {
            // Sign in verified -> go straight to dashboard
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

  // Guest bypass fallback if needed
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
      {/* Editorial Ambient Atmospheric Backdrop with Warm Champagne Aura */}
      <AmbientAtmosphere variant="editorial" />

      <View style={styles.content}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image
              source={require("../../assets/icon.png")}
              style={{ width: 38, height: 38, borderRadius: 10 }}
              resizeMode="cover"
            />
            <View>
              <Text style={styles.logoText}>Lumen OS</Text>
              <Text style={styles.logoSub}>Bio-Intelligence Platform</Text>
            </View>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tabBtn, authMode === "signup" && styles.tabBtnActive]}
              onPress={() => {
                triggerHaptic();
                setAuthMode("signup");
              }}
            >
              <Text style={[styles.tabBtnText, authMode === "signup" && styles.tabBtnTextActive]}>
                Sign Up
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabBtn, authMode === "signin" && styles.tabBtnActive]}
              onPress={() => {
                triggerHaptic();
                setAuthMode("signin");
              }}
            >
              <Text style={[styles.tabBtnText, authMode === "signin" && styles.tabBtnTextActive]}>
                Sign In
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Centerpiece: Zen Silhouette & Ambient Glow Aura (Image 1 Aesthetic) */}
        <View style={styles.zenGraphicContainer}>
          <Svg width={220} height={150} viewBox="0 0 220 150" style={{ position: "absolute" }}>
            <Defs>
              <SvgRadialGrad id="zenHalo" cx="50%" cy="50%" rx="50%" ry="50%">
                <SvgStop offset="0%" stopColor="#cfb9a5" stopOpacity="0.45" />
                <SvgStop offset="50%" stopColor="#b87a4c" stopOpacity="0.22" />
                <SvgStop offset="100%" stopColor="#1e1713" stopOpacity="0" />
              </SvgRadialGrad>
            </Defs>
            <Circle cx="110" cy="75" r="70" fill="url(#zenHalo)" />
            <Circle cx="110" cy="75" r="46" stroke="rgba(207, 185, 165, 0.3)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
            {/* Graceful Silhouette in Motion */}
            <Circle cx="110" cy="46" r="10" fill="rgba(255, 255, 255, 0.88)" />
            <SvgPath
              d="M110 58 C102 66, 96 80, 94 96 C94 108, 102 116, 110 116 C118 116, 126 108, 126 96 C124 80, 118 66, 110 58 Z"
              fill="rgba(255, 255, 255, 0.80)"
            />
            {/* Ambient motion wings radiating serene balance */}
            <SvgPath
              d="M104 68 C88 56, 68 54, 52 62 C68 72, 86 78, 98 80 Z"
              fill="rgba(207, 185, 165, 0.50)"
            />
            <SvgPath
              d="M116 68 C132 56, 152 54, 168 62 C152 72, 134 78, 122 80 Z"
              fill="rgba(207, 185, 165, 0.50)"
            />
            <SvgPath
              d="M86 108 C70 114, 60 124, 48 132 C68 132, 86 126, 94 116 Z"
              fill="rgba(207, 185, 165, 0.38)"
            />
            <SvgPath
              d="M134 108 C150 114, 160 124, 172 132 C152 132, 134 126, 126 116 Z"
              fill="rgba(207, 185, 165, 0.38)"
            />
          </Svg>
        </View>

        {/* Floating Category Pills (matching Image 1) */}
        <View style={styles.floatingPillsRow}>
          <View style={styles.floatingGlassPill}>
            <Text style={styles.floatingPillText}>Mindfulness</Text>
          </View>
          <View style={[styles.floatingGlassPill, styles.floatingPillActive]}>
            <Text style={[styles.floatingPillText, styles.floatingPillTextActive]}>Daily Bio-Tracking</Text>
          </View>
          <View style={styles.floatingGlassPill}>
            <Text style={styles.floatingPillText}>Circadian AI</Text>
          </View>
        </View>

        {/* Hero Copy (Bold, Ultra-Clean, Bright Sans-Serif Typography) */}
        <View style={styles.copyArea}>
          <Text style={styles.tagline}>
            {authMode === "signup" ? "Breathe Better.\nLive Calmer." : "Welcome Back.\nLive Calmer."}
          </Text>
          <Text style={styles.desc}>
            {authMode === "signup"
              ? "For bio-tracking, daily focus, circadian health and inner balance."
              : "Access your biometric memory, real-time vitals, and intelligent coach."}
          </Text>
        </View>

        {/* Auth Actions Area (Dual Luxury Pill Buttons matching Image 1) */}
        <View style={styles.actionSection}>
          <View style={styles.dualButtonRow}>
            {/* Primary Action Button: Warm Caramel Terracotta with Play / Sparkle Icon */}
            <Pressable
              style={({ pressed }) => [
                styles.caramelPillBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleGoogleAuthPress}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Play size={16} color="#ffffff" fill="#ffffff" />
                  <Text style={styles.caramelBtnText}>
                    {authMode === "signup" ? "Get Started" : "Continue"}
                  </Text>
                </>
              )}
            </Pressable>

            {/* Secondary Action Button: Crisp White Frosted Pill */}
            <Pressable
              style={({ pressed }) => [
                styles.whitePillBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
              onPress={authMode === "signup" ? handleOpenManualSignUp : handleOpenManualSignIn}
            >
              <Mail size={16} color="#0b1612" />
              <Text style={styles.whitePillBtnText}>Email Sign-In</Text>
            </Pressable>
          </View>

          {/* Quick Guest Bypass fallback */}
          <Pressable
            style={({ pressed }) => [
              styles.ghostBtn,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleGuestBypass}
          >
            <Text style={styles.ghostBtnText}>Continue as Guest / Offline</Text>
          </Pressable>

          {/* Switch Mode Prompt */}
          <Pressable
            style={styles.switchModeRow}
            onPress={() => {
              triggerHaptic();
              setAuthMode(authMode === "signup" ? "signin" : "signup");
            }}
          >
            <Text style={styles.switchModeText}>
              {authMode === "signup"
                ? "Already have an account? "
                : "New to Lumen Health OS? "}
              <Text style={styles.switchModeHighlight}>
                {authMode === "signup" ? "Sign In" : "Sign Up"}
              </Text>
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ShieldCheck size={14} color="#a3c2b6" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>Secure biometric privacy • Created by MeshMind</Text>
        </View>
      </View>

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
          <View style={styles.modalPanel}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <GoogleIcon size={24} />
                <View>
                  <Text style={styles.modalTitle}>
                    {authMode === "signup" ? "Sign up with Google" : "Sign in with Google"}
                  </Text>
                  <Text style={styles.modalSub}>to continue to Lumen Health OS</Text>
                </View>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowGoogleModal(false)}>
                <X size={16} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Quick account suggestion if available */}
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

            {/* Manual Gmail Input Card */}
            <View style={styles.inputCard}>
              <Text style={styles.inputCardLabel}>ENTER YOUR GMAIL ACCOUNT</Text>

              {/* Name field */}
              <View style={styles.inputRow}>
                <User size={16} color="#94a3b8" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Your Full Name (e.g., Alex Rivera)"
                  placeholderTextColor="#475569"
                  value={gmailName}
                  onChangeText={setGmailName}
                />
              </View>

              {/* Email field */}
              <View style={[styles.inputRow, { marginTop: 10 }]}>
                <Mail size={16} color="#94a3b8" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Gmail address (e.g., alex@gmail.com)"
                  placeholderTextColor="#475569"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={gmailAddress}
                  onChangeText={setGmailAddress}
                />
              </View>
            </View>

            {/* Ready for OAuth notice */}
            <View style={styles.oauthNoticeCard}>
              <Text style={styles.oauthNoticeTitle}>OAuth Integration Architecture</Text>
              <Text style={styles.oauthNoticeBody}>
                Full Google OAuth 2.0 flow is ready. When your Google Cloud OAuth Client ID is provided, this window opens Google's native authorization service automatically.
              </Text>
            </View>

            {/* Submit Button */}
            <Pressable
              style={styles.modalSubmitBtn}
              onPress={() => handleCompleteGoogleModal()}
              disabled={modalSubmitting}
            >
              {modalSubmitting ? (
                <ActivityIndicator size="small" color="#050b08" />
              ) : (
                <>
                  <GoogleIcon size={18} />
                  <Text style={styles.modalSubmitBtnText}>
                    {authMode === "signup" ? "Create Account with Gmail" : "Sign In with Gmail"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* EMAIL OTP VERIFICATION MODAL                             */}
      {/* ========================================================= */}
      <Modal
        visible={showOtpModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!otpSending && !otpVerifying) setShowOtpModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.otpHeaderIcon}>
                  <Mail size={18} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>
                    {authMode === "signup" ? "Email Verification" : "Sign In with Email"}
                  </Text>
                  <Text style={styles.modalSub}>
                    {otpStage === "enter_email"
                      ? "Step 1 of 2: Confirm your email"
                      : otpStage === "enter_otp"
                      ? "Step 2 of 2: Enter 6-digit code"
                      : "Verification Complete"}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowOtpModal(false)}
                disabled={otpSending || otpVerifying}
              >
                <X size={16} color="#94a3b8" />
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
                <Sparkles size={14} color="#10b981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.devBannerTitle}>Development Preview Code</Text>
                  <Text style={styles.devBannerBody}>
                    Tap to auto-fill code: <Text style={{ fontWeight: "900", color: "#10b981" }}>{devOtpNotification}</Text>
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {/* STAGE 1: ENTER EMAIL */}
            {otpStage === "enter_email" && (
              <View style={{ gap: 14 }}>
                <View style={styles.inputCard}>
                  <Text style={styles.inputCardLabel}>ENTER YOUR EMAIL ADDRESS</Text>
                  <View style={styles.inputRow}>
                    <Mail size={16} color="#94a3b8" />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. alex@example.com"
                      placeholderTextColor="#475569"
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
                </View>

                <View style={styles.securityNoticeRow}>
                  <Lock size={13} color="#10b981" />
                  <Text style={styles.securityNoticeText}>
                    A secure 6-digit verification code will be sent to this email. No password required.
                  </Text>
                </View>

                <Pressable
                  style={[styles.modalSubmitBtn, otpSending && { opacity: 0.7 }]}
                  onPress={handleRequestOtp}
                  disabled={otpSending}
                >
                  {otpSending ? (
                    <ActivityIndicator size="small" color="#050b08" />
                  ) : (
                    <>
                      <Text style={styles.modalSubmitBtnText}>Send Verification Code</Text>
                      <ArrowRight size={16} color="#050b08" />
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* STAGE 2: ENTER OTP */}
            {otpStage === "enter_otp" && (
              <View style={{ gap: 14 }}>
                {/* Active target email indicator */}
                <View style={styles.targetEmailRow}>
                  <Text style={styles.targetEmailText}>
                    Code sent to <Text style={{ color: "#f8fafc", fontWeight: "700" }}>{otpEmail}</Text>
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

                {/* 6-digit Code input card */}
                <View style={styles.inputCard}>
                  <View style={styles.otpInputHeaderRow}>
                    <Text style={styles.inputCardLabel}>6-DIGIT VERIFICATION CODE</Text>
                    <Text style={styles.expiryTimerText}>
                      Expires in {Math.floor(otpExpiresIn / 60)}:{(otpExpiresIn % 60).toString().padStart(2, "0")}
                    </Text>
                  </View>
                  <TextInput
                    style={styles.otpCodeInput}
                    placeholder="• • • • • •"
                    placeholderTextColor="#334155"
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

                <Pressable
                  style={[
                    styles.modalSubmitBtn,
                    (otpCode.length !== 6 || otpVerifying) && { opacity: otpCode.length === 6 ? 0.7 : 0.5 },
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpCode.length !== 6 || otpVerifying}
                >
                  {otpVerifying ? (
                    <ActivityIndicator size="small" color="#050b08" />
                  ) : (
                    <>
                      <ShieldCheck size={18} color="#050b08" />
                      <Text style={styles.modalSubmitBtnText}>Verify & Continue</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* STAGE 3: VERIFIED SUCCESS */}
            {otpStage === "verified" && (
              <View style={styles.verifiedContainer}>
                <View style={styles.verifiedIconBadge}>
                  <CheckCircle2 size={44} color="#10b981" />
                </View>
                <Text style={styles.verifiedTitle}>Email Verified!</Text>
                <Text style={styles.verifiedSub}>
                  {authMode === "signup"
                    ? "Welcome to Lumen. Now let's set up your bio-profile..."
                    : "Signing you into Lumen Health OS..."}
                </Text>
                <ActivityIndicator size="small" color="#10b981" style={{ marginTop: 12 }} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
  },
  radialGlow: {
    position: "absolute",
    top: "-10%",
    left: "50%",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(16, 185, 129, 0.09)",
    transform: [{ translateX: -200 }],
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: Platform.OS === "ios" ? 70 : 50,
    paddingBottom: 30,
    justifyContent: "space-between",
  },
  header: {
    gap: 20,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
    letterSpacing: -0.3,
  },
  logoSub: {
    fontSize: 11,
    color: THEME.colors.accentGreen,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(232, 241, 237, 0.15)",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: THEME.colors.accentTeal,
  },
  tabBtnText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  tabBtnTextActive: {
    color: "#ffffff",
  },
  copyArea: {
    marginVertical: 20,
  },
  tagline: {
    fontSize: 38,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
    lineHeight: 44,
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  desc: {
    fontSize: 15,
    color: THEME.colors.textOnDarkSecondary,
    lineHeight: 22,
  },
  actionSection: {
    gap: 12,
  },
  zenGraphicContainer: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  floatingPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginVertical: 6,
  },
  floatingGlassPill: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  floatingPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    borderColor: "rgba(255, 255, 255, 0.45)",
  },
  floatingPillText: {
    color: "#e2ece7",
    fontSize: 11,
    fontWeight: "700",
  },
  floatingPillTextActive: {
    color: "#ffffff",
    fontWeight: "900",
  },
  dualButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  caramelPillBtn: {
    flex: 1,
    height: 52,
    backgroundColor: THEME.colors.accentCaramel,
    borderRadius: 26,
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
  caramelBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  whitePillBtn: {
    flex: 1,
    height: 52,
    backgroundColor: "#ffffff",
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  whitePillBtnText: {
    color: "#0b1612",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  ghostBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  ghostBtnText: {
    color: "#d4e8df",
    fontSize: 12,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // Google Button
  googleBtn: {
    height: 54,
    backgroundColor: "#ffffff",
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    ...THEME.shadows.card,
  },
  googleIconBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleBtnText: {
    color: "#162621",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(200, 218, 210, 0.2)",
  },
  dividerText: {
    color: THEME.colors.textOnDarkTertiary,
    fontSize: 11,
    fontWeight: "700",
  },

  // Secondary Button
  secondaryBtn: {
    height: 52,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    color: THEME.colors.textOnDarkPrimary,
    fontSize: 14,
    fontWeight: "700",
  },

  switchModeRow: {
    alignItems: "center",
    marginTop: 6,
    paddingVertical: 6,
  },
  switchModeText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 13,
  },
  switchModeHighlight: {
    color: THEME.colors.accentGreen,
    fontWeight: "800",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  footerText: {
    fontSize: 11,
    color: THEME.colors.textOnDarkTertiary,
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.8)",
    justifyContent: "flex-end",
  },
  modalPanel: {
    backgroundColor: THEME.colors.drawerBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(200, 218, 210, 0.25)",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: Platform.OS === "ios" ? 44 : 26,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: THEME.colors.textOnDarkSecondary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedAccountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  savedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedAvatarText: {
    color: THEME.colors.accentGreen,
    fontSize: 16,
    fontWeight: "800",
  },
  savedName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  savedEmail: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
  },
  inputCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 8,
    ...THEME.shadows.card,
  },
  inputCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
  },
  textInput: {
    flex: 1,
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
  },
  oauthNoticeCard: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.25)",
  },
  oauthNoticeTitle: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 2,
  },
  oauthNoticeBody: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  modalSubmitBtn: {
    height: 52,
    backgroundColor: THEME.colors.accentGreen,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalSubmitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },

  // OTP Modal Styles
  otpHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorBannerText: {
    color: "#f87171",
    fontSize: 12,
    flex: 1,
  },
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  devBannerTitle: {
    color: THEME.colors.accentGreen,
    fontSize: 11,
    fontWeight: "800",
  },
  devBannerBody: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  securityNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  securityNoticeText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  targetEmailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
  },
  targetEmailText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
  },
  changeEmailLink: {
    color: THEME.colors.accentGreen,
    fontSize: 12,
    fontWeight: "700",
  },
  otpInputHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  expiryTimerText: {
    color: THEME.colors.accentGreen,
    fontSize: 11,
    fontWeight: "700",
  },
  otpCodeInput: {
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: THEME.colors.accentGreen,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 10,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  resendPrompt: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
  },
  resendCooldownText: {
    color: THEME.colors.textOnDarkTertiary,
    fontSize: 12,
    fontWeight: "600",
  },
  resendActionLink: {
    color: THEME.colors.accentGreen,
    fontSize: 12,
    fontWeight: "800",
  },
  verifiedContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  verifiedIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    marginBottom: 6,
  },
  verifiedTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  verifiedSub: {
    fontSize: 13,
    color: THEME.colors.textOnDarkSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
