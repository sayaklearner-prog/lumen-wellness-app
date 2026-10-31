import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import { getStoredGoogleUser } from "@/services/googleAuth";
import { authService } from "@/services/authService";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  User,
  Minus,
  Plus,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PersonalInformationScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const updateProfile = useUpdateProfile();

  // Core Personal Details (Matching Reference Video)
  const [name, setName] = useState<string>(profile?.name || "");
  const [gender, setGender] = useState<"Male" | "Female" | null>(null);
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState<boolean>(false);

  // Weight State & Ruler Modal
  const [weightKg, setWeightKg] = useState<number>(75);
  const [weightUnit, setWeightUnit] = useState<"KG" | "LBS">("KG");
  const [showWeightModal, setShowWeightModal] = useState<boolean>(false);
  const [tempWeight, setTempWeight] = useState<number>(75);

  // Height State & Ruler Modal
  const [heightCm, setHeightCm] = useState<number>(175);
  const [heightUnit, setHeightUnit] = useState<"Cm" | "Ft">("Cm");
  const [showHeightModal, setShowHeightModal] = useState<boolean>(false);
  const [tempHeight, setTempHeight] = useState<number>(175);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  // Prefill name from Google or verified email if available
  useEffect(() => {
    async function initUserSession() {
      try {
        if (profile?.name && !name) {
          setName(profile.name);
        }
        const gUser = await getStoredGoogleUser();
        if (gUser?.name && !name) {
          setName(gUser.name);
        } else {
          const vEmail = await authService.getVerifiedEmail();
          if (vEmail && !name) {
            const prefix = vEmail.split("@")[0].replace(/[._-]/g, " ");
            setName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        }
      } catch {}
    }
    initUserSession();
  }, [profile]);

  // Handle Weight Modal Open
  const handleOpenWeightModal = () => {
    triggerHaptic();
    setTempWeight(weightKg);
    setShowWeightModal(true);
  };

  // Handle Height Modal Open
  const handleOpenHeightModal = () => {
    triggerHaptic();
    setTempHeight(heightCm);
    setShowHeightModal(true);
  };

  // Confirm Weight Selection
  const handleConfirmWeight = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setWeightKg(tempWeight);
    setShowWeightModal(false);
  };

  // Confirm Height Selection
  const handleConfirmHeight = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setHeightCm(tempHeight);
    setShowHeightModal(false);
  };

  // Save Personal Information and Finish
  const handleNext = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Name Required", "Please enter your name to complete your personal profile.");
      return;
    }

    setIsSubmitting(true);

    // Compute tailored baseline health targets based on personal telemetry
    const isMale = gender === "Male";
    const calorieTarget = isMale ? Math.round(weightKg * 28 + 400) : Math.round(weightKg * 26 + 250);
    const proteinTarget = Math.round(weightKg * 1.6); // 1.6g per kg of bodyweight

    const profilePayload = {
      name: cleanName,
      mode: "standard",
      dailyCalorieTarget: Math.max(1600, Math.min(3200, calorieTarget)),
      dailyProteinTarget: Math.max(70, Math.min(180, proteinTarget)),
      dailyStepsTarget: 9000,
      dailySleepTargetHours: 8.0,
      dailyScreenTimeLimitMinutes: 180,
      onboardingComplete: true,
    };

    // Guarantee local storage & auth flags are persisted
    await storage.setItem("lumen_auth_token", "authenticated");
    await storage.setItem("lumen_onboarding_completed", "true");
    await storage.removeItem("lumen_in_onboarding");
    await storage.setItem(
      "lumen_personal_details",
      JSON.stringify({
        name: cleanName,
        gender: gender || "Not specified",
        weightKg,
        weightUnit,
        heightCm,
        heightUnit,
      })
    );

    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_authenticated", "true");
      localStorage.setItem("lumen_onboarding_completed", "true");
      localStorage.removeItem("lumen_in_onboarding");
      localStorage.setItem("lumen_local_profile", JSON.stringify(profilePayload));
    }

    try {
      await updateProfile.mutateAsync({
        data: profilePayload,
      });
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      router.replace("/(tabs)");
    } catch (err: any) {
      console.warn("[Onboarding] Profile sync postponed:", err?.message);
      router.replace("/(tabs)");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header Row with Circular Back Button */}
      <View style={styles.topBar}>
        <Pressable
          style={styles.backCircleBtn}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <ChevronLeft size={20} color="#ffffff" strokeWidth={2.4} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Screen Title & Subtitle Matching Video */}
        <View style={styles.titleSection}>
          <Text style={styles.screenTitle}>Personal Information</Text>
          <Text style={styles.screenSubtitle}>
            Provide required information to create your account
          </Text>
        </View>

        {/* 1. Name Field */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Name</Text>
          <View style={styles.capsuleInputBox}>
            <TextInput
              style={styles.capsuleTextInput}
              placeholder="Your name"
              placeholderTextColor="#5a7065"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* 2. Gender & Weight Row Matching Video Layout */}
        <View style={styles.rowFields}>
          {/* Gender Selector */}
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <Pressable
              style={styles.capsulePillBtn}
              onPress={() => {
                triggerHaptic();
                setIsGenderDropdownOpen(!isGenderDropdownOpen);
              }}
            >
              <Text
                style={[
                  styles.capsulePillText,
                  !gender && { color: "#5a7065" },
                ]}
                numberOfLines={1}
              >
                {gender || "Select Gender"}
              </Text>
              {isGenderDropdownOpen ? (
                <ChevronUp size={16} color="#8ea69b" />
              ) : (
                <ChevronDown size={16} color="#8ea69b" />
              )}
            </Pressable>

            {/* Gender Dropdown Menu */}
            {isGenderDropdownOpen && (
              <View style={styles.genderDropdownCard}>
                <Pressable
                  style={[
                    styles.genderDropdownItem,
                    gender === "Male" && styles.genderDropdownItemActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setGender("Male");
                    setIsGenderDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.genderItemText,
                      gender === "Male" && styles.genderItemTextActive,
                    ]}
                  >
                    Male
                  </Text>
                  {gender === "Male" && <Check size={14} color="#d4f933" strokeWidth={2.8} />}
                </Pressable>

                <View style={styles.dropdownDivider} />

                <Pressable
                  style={[
                    styles.genderDropdownItem,
                    gender === "Female" && styles.genderDropdownItemActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setGender("Female");
                    setIsGenderDropdownOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.genderItemText,
                      gender === "Female" && styles.genderItemTextActive,
                    ]}
                  >
                    Female
                  </Text>
                  {gender === "Female" && <Check size={14} color="#d4f933" strokeWidth={2.8} />}
                </Pressable>
              </View>
            )}
          </View>

          {/* Weight Selector */}
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Weight</Text>
            <Pressable style={styles.capsulePillBtn} onPress={handleOpenWeightModal}>
              <Text style={styles.capsulePillText} numberOfLines={1}>
                {weightKg ? `${weightKg} ${weightUnit.toLowerCase()}` : "Weight"}
              </Text>
              <ChevronRight size={16} color="#8ea69b" />
            </Pressable>
          </View>
        </View>

        {/* 3. Height Field */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Height</Text>
          <Pressable style={styles.capsulePillBtn} onPress={handleOpenHeightModal}>
            <Text style={styles.capsulePillText} numberOfLines={1}>
              {heightCm ? `${heightCm} ${heightUnit.toLowerCase()}` : "Select height"}
            </Text>
            <ChevronRight size={16} color="#8ea69b" />
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Pinned Vibrant Lime "Next" Action Button */}
      <View style={styles.bottomFooter}>
        <Pressable
          style={({ pressed }) => [
            styles.nextVibrantBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            isSubmitting && { opacity: 0.7 },
          ]}
          onPress={handleNext}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#0b1410" />
          ) : (
            <Text style={styles.nextVibrantBtnText}>Next</Text>
          )}
        </Pressable>
      </View>

      {/* ========================================================= */}
      {/* 4. INTERACTIVE WEIGHT RULER MODAL (Matching Video)         */}
      {/* ========================================================= */}
      <Modal
        visible={showWeightModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWeightModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowWeightModal(false)} />
          <View style={styles.rulerModalPanel}>
            {/* Handle */}
            <View style={styles.modalHandle} />

            {/* Header: Set Weight + Unit Pill */}
            <View style={styles.rulerHeaderRow}>
              <Text style={styles.rulerModalTitle}>Set Weight</Text>
              <Pressable
                style={styles.unitTogglePill}
                onPress={() => {
                  triggerHaptic();
                  setWeightUnit(weightUnit === "KG" ? "LBS" : "KG");
                }}
              >
                <Text style={styles.unitToggleText}>{weightUnit} ˅</Text>
              </Pressable>
            </View>

            {/* Interactive Scale Ruler Area */}
            <View style={styles.rulerAreaContainer}>
              {/* Active Value Floating Bubble */}
              <View style={styles.valueBubble}>
                <Text style={styles.valueBubbleText}>{tempWeight}</Text>
              </View>
              {/* Pointer Triangle */}
              <View style={styles.bubblePointer} />

              {/* Stepper Adjustment Controls & Visual Scale Ruler */}
              <View style={styles.stepperRulerRow}>
                <Pressable
                  style={styles.rulerStepArrowBtn}
                  onPress={() => {
                    triggerHaptic();
                    setTempWeight((prev) => Math.max(35, prev - 1));
                  }}
                >
                  <Minus size={18} color="#d4f933" />
                </Pressable>

                {/* Simulated Visual Ruler with Tick Marks */}
                <View style={styles.rulerTicksTrack}>
                  {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((offset) => {
                    const tickVal = tempWeight + offset;
                    const isCenter = offset === 0;
                    const isMajor = tickVal % 5 === 0;
                    return (
                      <Pressable
                        key={offset}
                        style={styles.tickItem}
                        onPress={() => {
                          triggerHaptic();
                          setTempWeight(Math.max(35, tickVal));
                        }}
                      >
                        <View
                          style={[
                            styles.tickBar,
                            isCenter
                              ? styles.tickBarCenter
                              : isMajor
                              ? styles.tickBarMajor
                              : styles.tickBarMinor,
                          ]}
                        />
                        {isMajor && (
                          <Text style={[styles.tickNumberText, isCenter && styles.tickNumberCenter]}>
                            {tickVal}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.rulerStepArrowBtn}
                  onPress={() => {
                    triggerHaptic();
                    setTempWeight((prev) => Math.min(220, prev + 1));
                  }}
                >
                  <Plus size={18} color="#d4f933" />
                </Pressable>
              </View>
            </View>

            {/* Confirm Vibrant Lime Button */}
            <Pressable
              style={({ pressed }) => [
                styles.confirmVibrantBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
              onPress={handleConfirmWeight}
            >
              <Text style={styles.confirmVibrantBtnText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 5. INTERACTIVE HEIGHT RULER MODAL (Matching Video)         */}
      {/* ========================================================= */}
      <Modal
        visible={showHeightModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHeightModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setShowHeightModal(false)} />
          <View style={styles.rulerModalPanel}>
            {/* Handle */}
            <View style={styles.modalHandle} />

            {/* Header: Set Height + Unit Pill */}
            <View style={styles.rulerHeaderRow}>
              <Text style={styles.rulerModalTitle}>Set Height</Text>
              <Pressable
                style={styles.unitTogglePill}
                onPress={() => {
                  triggerHaptic();
                  setHeightUnit(heightUnit === "Cm" ? "Ft" : "Cm");
                }}
              >
                <Text style={styles.unitToggleText}>{heightUnit} ˅</Text>
              </Pressable>
            </View>

            {/* Interactive Scale Ruler Area */}
            <View style={styles.rulerAreaContainer}>
              {/* Active Value Floating Bubble */}
              <View style={styles.valueBubble}>
                <Text style={styles.valueBubbleText}>{tempHeight}</Text>
              </View>
              {/* Pointer Triangle */}
              <View style={styles.bubblePointer} />

              {/* Stepper Adjustment Controls & Visual Scale Ruler */}
              <View style={styles.stepperRulerRow}>
                <Pressable
                  style={styles.rulerStepArrowBtn}
                  onPress={() => {
                    triggerHaptic();
                    setTempHeight((prev) => Math.max(100, prev - 1));
                  }}
                >
                  <Minus size={18} color="#d4f933" />
                </Pressable>

                {/* Simulated Visual Ruler with Tick Marks */}
                <View style={styles.rulerTicksTrack}>
                  {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((offset) => {
                    const tickVal = tempHeight + offset;
                    const isCenter = offset === 0;
                    const isMajor = tickVal % 5 === 0;
                    return (
                      <Pressable
                        key={offset}
                        style={styles.tickItem}
                        onPress={() => {
                          triggerHaptic();
                          setTempHeight(Math.max(100, tickVal));
                        }}
                      >
                        <View
                          style={[
                            styles.tickBar,
                            isCenter
                              ? styles.tickBarCenter
                              : isMajor
                              ? styles.tickBarMajor
                              : styles.tickBarMinor,
                          ]}
                        />
                        {isMajor && (
                          <Text style={[styles.tickNumberText, isCenter && styles.tickNumberCenter]}>
                            {tickVal}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.rulerStepArrowBtn}
                  onPress={() => {
                    triggerHaptic();
                    setTempHeight((prev) => Math.min(230, prev + 1));
                  }}
                >
                  <Plus size={18} color="#d4f933" />
                </Pressable>
              </View>
            </View>

            {/* Confirm Vibrant Lime Button */}
            <Pressable
              style={({ pressed }) => [
                styles.confirmVibrantBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
              onPress={handleConfirmHeight}
            >
              <Text style={styles.confirmVibrantBtnText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b120f", // Ultra-sleek dark charcoal background matching reference video
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  topBar: {
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  backCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 110,
  },
  titleSection: {
    marginBottom: 26,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 13,
    color: "#7e978b",
    marginTop: 6,
    lineHeight: 18,
  },
  fieldBlock: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c2d4cb",
    marginBottom: 8,
  },
  capsuleInputBox: {
    backgroundColor: "#131e18",
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  capsuleTextInput: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  rowFields: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  capsulePillBtn: {
    backgroundColor: "#131e18",
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  capsulePillText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    marginRight: 6,
  },

  // Gender Dropdown Card
  genderDropdownCard: {
    backgroundColor: "#15221b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    marginTop: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  genderDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  genderDropdownItemActive: {
    backgroundColor: "rgba(212, 249, 51, 0.12)",
  },
  genderItemText: {
    color: "#c2d4cb",
    fontSize: 14,
    fontWeight: "700",
  },
  genderItemTextActive: {
    color: "#d4f933",
    fontWeight: "900",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },

  // Bottom Footer Next Button
  bottomFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    backgroundColor: "#0b120f",
  },
  nextVibrantBtn: {
    height: 54,
    backgroundColor: "#d4f933", // Vibrant Electric Lime matching video
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#d4f933",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  nextVibrantBtnText: {
    color: "#0b1410",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  // Ruler Modal Styles (Matching video frames 11.0 & 16.0)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 10, 8, 0.78)",
    justifyContent: "flex-end",
  },
  rulerModalPanel: {
    backgroundColor: "#111c16",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 38 : 24,
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignSelf: "center",
    marginBottom: 16,
  },
  rulerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  rulerModalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  unitTogglePill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  unitToggleText: {
    color: "#d4f933",
    fontSize: 12,
    fontWeight: "800",
  },
  rulerAreaContainer: {
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 20,
  },
  valueBubble: {
    backgroundColor: "#d4f933", // Neon lime active bubble
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: "#d4f933",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  valueBubbleText: {
    color: "#0b1410",
    fontSize: 18,
    fontWeight: "900",
  },
  bubblePointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#d4f933",
    marginBottom: 12,
  },
  stepperRulerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  rulerStepArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(212, 249, 51, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(212, 249, 51, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  rulerTicksTrack: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    height: 70,
    paddingHorizontal: 6,
  },
  tickItem: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 20,
  },
  tickBar: {
    borderRadius: 2,
  },
  tickBarCenter: {
    width: 3.5,
    height: 44,
    backgroundColor: "#d4f933",
    shadowColor: "#d4f933",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  tickBarMajor: {
    width: 2.5,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
  },
  tickBarMinor: {
    width: 1.5,
    height: 18,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  tickNumberText: {
    color: "#7e978b",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
  },
  tickNumberCenter: {
    color: "#d4f933",
    fontWeight: "900",
  },
  confirmVibrantBtn: {
    height: 52,
    backgroundColor: "#d4f933",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#d4f933",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmVibrantBtnText: {
    color: "#0b1410",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
});
