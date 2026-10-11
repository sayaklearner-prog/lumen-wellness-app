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
      {/* Ambient botanical background glow */}
      <View style={styles.radialGlow} />

      <View style={styles.content}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image
              source={require("../../assets/icon.png")}
              style={{ width: 44, height: 44, borderRadius: 12 }}
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

        {/* Hero Copy */}
        <View style={styles.copyArea}>
          <Text style={styles.tagline}>
            {authMode === "signup" ? "Begin Your Health Evolution." : "Welcome Back to Lumen."}
          </Text>
          <Text style={styles.desc}>
            {authMode === "signup"
              ? "Sign up with Gmail to synchronize real-time biometrics, nutrition, circadian sleep, and AI health memory."
              : "Sign in with your Google account to access your biometric dashboard, wellness records, and AI coach."}
          </Text>
        </View>

        {/* Auth Actions Area */}
        <View style={styles.actionSection}>
          {/* ========================================================= */}
          {/* PROMINENT GOOGLE / GMAIL LOGIN & SIGN UP BUTTON           */}
          {/* ========================================================= */}
          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleGoogleAuthPress}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#050b08" />
            ) : (
              <>
                <View style={styles.googleIconBox}>
                  <GoogleIcon size={22} />
                </View>
                <Text style={styles.googleBtnText}>
                  {authMode === "signup" ? "Sign up with Gmail" : "Sign in with Google"}
                </Text>
              </>
            )}
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Secondary Action */}
          {authMode === "signup" ? (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleOpenManualSignUp}
            >
              <Mail size={16} color="#10b981" />
              <Text style={styles.secondaryBtnText}>Sign Up with Email Verification</Text>
              <ArrowRight size={16} color="#94a3b8" />
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleOpenManualSignIn}
              >
                <Mail size={16} color="#10b981" />
                <Text style={styles.secondaryBtnText}>Sign In with Email Code</Text>
                <ArrowRight size={16} color="#94a3b8" />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.ghostBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleGuestBypass}
              >
                <Text style={styles.ghostBtnText}>Continue as Guest / Offline</Text>
              </Pressable>
            </View>
          )}

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
          <ShieldCheck size={14} color="#64748b" style={{ marginRight: 6 }} />
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
    backgroundColor: "#050b08",
  },
  radialGlow: {
    position: "absolute",
    top: "-10%",
    left: "50%",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(16, 185, 129, 0.07)",
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.3,
  },
  logoSub: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#0c1511",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: "#16251e",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  tabBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "700",
  },
  tabBtnTextActive: {
    color: "#10b981",
  },
  copyArea: {
    marginVertical: 20,
  },
  tagline: {
    fontSize: 38,
    fontWeight: "900",
    color: "#f8fafc",
    lineHeight: 44,
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  desc: {
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 22,
  },
  actionSection: {
    gap: 14,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  googleIconBox: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleBtnText: {
    color: "#1f2937",
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  dividerText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },

  // Secondary Button
  secondaryBtn: {
    height: 50,
    backgroundColor: "#0d1612",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },

  switchModeRow: {
    alignItems: "center",
    marginTop: 6,
    paddingVertical: 6,
  },
  switchModeText: {
    color: "#64748b",
    fontSize: 13,
  },
  switchModeHighlight: {
    color: "#10b981",
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
    color: "#64748b",
  },

  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalPanel: {
    backgroundColor: "#070c0a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(16, 185, 129, 0.3)",
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
    color: "#f8fafc",
  },
  modalSub: {
    fontSize: 12,
    color: "#94a3b8",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedAccountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0d1612",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
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
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  savedEmail: {
    color: "#94a3b8",
    fontSize: 11,
  },
  inputCard: {
    backgroundColor: "#0d1612",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  inputCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#121d18",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  textInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 13,
  },
  oauthNoticeCard: {
    backgroundColor: "rgba(66, 133, 244, 0.08)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(66, 133, 244, 0.2)",
  },
  oauthNoticeTitle: {
    color: "#60a5fa",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 2,
  },
  oauthNoticeBody: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 15,
  },
  modalSubmitBtn: {
    height: 50,
    backgroundColor: "#10b981",
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modalSubmitBtnText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "800",
  },

  // Ghost Button
  ghostBtn: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },

  // OTP Modal Styles
  otpHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
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
    backgroundColor: "rgba(16, 185, 129, 0.12)",
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
    color: "#94a3b8",
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
    color: "#64748b",
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  targetEmailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0d1612",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  targetEmailText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  changeEmailLink: {
    color: "#10b981",
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
    color: "#10b981",
    fontSize: 11,
    fontWeight: "700",
  },
  otpCodeInput: {
    backgroundColor: "#121d18",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#10b981",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 10,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  resendPrompt: {
    color: "#64748b",
    fontSize: 12,
  },
  resendCooldownText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  resendActionLink: {
    color: "#10b981",
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
    color: "#f8fafc",
  },
  verifiedSub: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
