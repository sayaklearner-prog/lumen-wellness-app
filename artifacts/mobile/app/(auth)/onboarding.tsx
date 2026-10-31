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
  PanResponder,
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
  Minus,
  Plus,
  Footprints,
  Utensils,
  Moon,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Activity,
  Heart,
  Scale,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Health Modes / Clinical Protocols (The "Diseases & Medical Focus Part")
const HEALTH_MODES = [
  {
    id: "standard",
    title: "Standard Longevity & Vitality",
    badge: "General Wellness",
    icon: "🌱",
    desc: "Balanced diurnal rhythms, athletic baseline endurance, and natural metabolic vitality.",
  },
  {
    id: "diabetes",
    title: "Diabetes & Blood Glucose Care",
    badge: "Clinical Protocol",
    icon: "🩸",
    desc: "Postprandial glycemic load tracking, insulin sensitivity pacing, and low-GI nutritional guidance.",
  },
  {
    id: "heart_health",
    title: "Cardiovascular & Heart Health",
    badge: "Cardio Focus",
    icon: "❤️",
    desc: "Vagal tone stabilization, resting heart rate recovery, and cardio endurance protection.",
  },
  {
    id: "weight_loss",
    title: "Weight & Metabolic Optimization",
    badge: "Recomposition",
    icon: "⚖️",
    desc: "Structured caloric deficit, leucine-rich protein synthesis, and metabolic rate elevation.",
  },
  {
    id: "pregnancy",
    title: "Prenatal & Pregnancy Protocol",
    badge: "Maternal Care",
    icon: "🤰",
    desc: "Gentle mobility pacing, restorative sleep architecture, and prenatal nutrient density.",
  },
];

// Tactile Haptic Helper
const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== "web") {
    try {
      Haptics.impactAsync(style);
    } catch {}
  }
};

// ============================================================================
// INTERACTIVE SLIDING RULER MODAL PICKER (With Full Touch-Drag Pan Gestures)
// ============================================================================
interface InteractiveRulerModalProps {
  visible: boolean;
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onToggleUnit: () => void;
  presets?: number[];
  onChange: (val: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function InteractiveRulerModal({
  visible,
  title,
  value,
  min,
  max,
  step = 1,
  unit,
  onToggleUnit,
  presets = [],
  onChange,
  onConfirm,
  onClose,
}: InteractiveRulerModalProps) {
  const initialValRef = useRef<number>(value);
  const currentValRef = useRef<number>(value);
  currentValRef.current = value;

  const repeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any holding repeat timer on unmount
  useEffect(() => {
    return () => {
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    };
  }, []);

  const startHoldRepeat = (direction: -1 | 1) => {
    triggerHaptic();
    const next = direction > 0 ? Math.min(max, value + step) : Math.max(min, value - step);
    currentValRef.current = next;
    onChange(next);

    if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);
    repeatTimerRef.current = setInterval(() => {
      const prev = currentValRef.current;
      const updated = direction > 0 ? Math.min(max, prev + step) : Math.max(min, prev - step);
      if (updated !== prev) {
        currentValRef.current = updated;
        onChange(updated);
        if (Platform.OS !== "web") {
          try {
            Haptics.selectionAsync();
          } catch {}
        }
      }
    }, 120);
  };

  const stopHoldRepeat = () => {
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  };

  // True horizontal touch-drag pan responder across the ruler track
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 1,
      onPanResponderGrant: () => {
        initialValRef.current = currentValRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        // Every 8 pixels dragged horizontally adjusts by 1 step
        const PIXELS_PER_STEP = 8;
        // Dragging right (dx > 0) pulls value up; dragging left (dx < 0) pulls value down
        const deltaSteps = Math.round(gestureState.dx / PIXELS_PER_STEP);
        const nextVal = Math.min(max, Math.max(min, initialValRef.current + deltaSteps * step));
        if (nextVal !== currentValRef.current) {
          currentValRef.current = nextVal;
          onChange(nextVal);
          if (Platform.OS !== "web") {
            try {
              Haptics.selectionAsync();
            } catch {}
          }
        }
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  ).current;

  // Generate 11 visible tick marks around the current value
  const tickOffsets = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.rulerModalPanel}>
          {/* Top Drag Handle */}
          <View style={styles.modalHandle} />

          {/* Header Row: Title & Unit Pill */}
          <View style={styles.rulerHeaderRow}>
            <Text style={styles.rulerModalTitle}>{title}</Text>
            <Pressable style={styles.unitTogglePill} onPress={onToggleUnit}>
              <Text style={styles.unitToggleText}>{unit} ˅</Text>
            </Pressable>
          </View>

          {/* Floating Number Bubble */}
          <View style={styles.valueBubbleContainer}>
            <View style={styles.valueBubble}>
              <Text style={styles.valueBubbleText}>
                {value} <Text style={{ fontSize: 13, fontWeight: "700" }}>{unit.toLowerCase()}</Text>
              </Text>
            </View>
            <View style={styles.bubblePointer} />
          </View>

          {/* Touch-Drag Sliding Ruler Area */}
          <View style={styles.rulerDragWrapper}>
            <View style={styles.stepperRulerRow}>
              {/* Stepper Minus Button (With hold-to-repeat) */}
              <Pressable
                style={styles.rulerStepArrowBtn}
                onPressIn={() => startHoldRepeat(-1)}
                onPressOut={stopHoldRepeat}
                accessibilityLabel="Decrease value"
              >
                <Minus size={18} color="#d4f933" />
              </Pressable>

              {/* Ticks Track with PanResponder (Drag left/right to slide) */}
              <View
                style={[
                  styles.rulerTicksTrack,
                  Platform.OS === "web"
                    ? ({ touchAction: "none", userSelect: "none", cursor: "ew-resize" } as any)
                    : null,
                ]}
                {...panResponder.panHandlers}
              >
                {tickOffsets.map((offset) => {
                  const tickVal = value + offset * step;
                  const isCenter = offset === 0;
                  const isMajor = tickVal % (step * 5) === 0;
                  const isOutOfBounds = tickVal < min || tickVal > max;

                  if (isOutOfBounds) {
                    return <View key={offset} style={styles.tickItem} />;
                  }

                  return (
                    <Pressable
                      key={offset}
                      style={styles.tickItem}
                      onPress={() => {
                        triggerHaptic();
                        onChange(tickVal);
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
                        <Text
                          style={[
                            styles.tickNumberText,
                            isCenter && styles.tickNumberCenter,
                          ]}
                          numberOfLines={1}
                        >
                          {tickVal}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Stepper Plus Button (With hold-to-repeat) */}
              <Pressable
                style={styles.rulerStepArrowBtn}
                onPressIn={() => startHoldRepeat(1)}
                onPressOut={stopHoldRepeat}
                accessibilityLabel="Increase value"
              >
                <Plus size={18} color="#d4f933" />
              </Pressable>
            </View>

            {/* Slide Gesture Instruction Hint */}
            <Text style={styles.rulerSlideHint}>
              ← Slide finger left or right on ruler to adjust • Tap presets below →
            </Text>
          </View>

          {/* Quick Preset Pills */}
          {presets.length > 0 && (
            <View style={styles.rulerPresetsRow}>
              {presets.map((p) => {
                const isSelected = value === p;
                return (
                  <Pressable
                    key={p}
                    style={[styles.rulerPresetPill, isSelected && styles.rulerPresetPillActive]}
                    onPress={() => {
                      triggerHaptic();
                      onChange(p);
                    }}
                  >
                    <Text
                      style={[styles.rulerPresetText, isSelected && styles.rulerPresetTextActive]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Confirm Button */}
          <Pressable
            style={({ pressed }) => [
              styles.confirmVibrantBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmVibrantBtnText}>Confirm</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// STEPPER CARD FOR STEP 3 (Daily Targets: Movement, Calories, Protein, Sleep)
// ============================================================================
interface GoalSliderCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  presets?: number[];
  onChange: (val: number) => void;
}

function GoalSliderCard({
  icon,
  title,
  value,
  unit,
  min,
  max,
  step,
  presets = [],
  onChange,
}: GoalSliderCardProps) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalCardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon}
          <Text style={styles.goalTitle}>{title}</Text>
        </View>
        <Text style={styles.goalValueText}>
          {value.toLocaleString()} <Text style={styles.goalUnitText}>{unit}</Text>
        </Text>
      </View>

      {/* Stepper Progress Bar */}
      <View style={styles.stepperBarRow}>
        <Pressable
          style={styles.goalMinusPlusBtn}
          onPress={() => {
            triggerHaptic();
            onChange(Math.max(min, value - step));
          }}
        >
          <Minus size={16} color="#ffffff" />
        </Pressable>

        <View style={styles.goalTrackContainer}>
          <View style={styles.goalTrackBg}>
            <View style={[styles.goalTrackFill, { width: `${percentage}%` }]} />
            <View style={[styles.goalTrackKnob, { left: `${Math.max(0, Math.min(93, percentage))}%` }]} />
          </View>
        </View>

        <Pressable
          style={styles.goalMinusPlusBtn}
          onPress={() => {
            triggerHaptic();
            onChange(Math.min(max, value + step));
          }}
        >
          <Plus size={16} color="#d4f933" />
        </Pressable>
      </View>

      {/* Quick Presets */}
      {presets.length > 0 && (
        <View style={styles.goalPresetsRow}>
          {presets.map((p) => {
            const isSelected = value === p;
            return (
              <Pressable
                key={p}
                style={[styles.goalPresetPill, isSelected && styles.goalPresetPillSelected]}
                onPress={() => {
                  triggerHaptic();
                  onChange(p);
                }}
              >
                <Text style={[styles.goalPresetText, isSelected && styles.goalPresetTextSelected]}>
                  {p.toLocaleString()}
                  {unit === "kcal" ? "" : unit === "m" ? "m" : unit === "hrs" ? "h" : unit === "g" ? "g" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT: 3-STEP ONBOARDING ENGINE
// ============================================================================
export default function PersonalInformationScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const updateProfile = useUpdateProfile();

  // Step state: 1 = Personal Info, 2 = Health & Medical Focus, 3 = Movement & Nutrients Goals
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Personal Details
  const [name, setName] = useState<string>(profile?.name || "");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState<boolean>(false);

  // Weight State
  const [weightVal, setWeightVal] = useState<number>(75);
  const [weightUnit, setWeightUnit] = useState<"KG" | "LBS">("KG");
  const [showWeightModal, setShowWeightModal] = useState<boolean>(false);

  // Height State
  const [heightVal, setHeightVal] = useState<number>(175);
  const [heightUnit, setHeightUnit] = useState<"Cm" | "Ft">("Cm");
  const [showHeightModal, setShowHeightModal] = useState<boolean>(false);

  // Step 2: Health & Medical Protocol Focus ("Diseases part")
  const [selectedMode, setSelectedMode] = useState<string>(profile?.mode || "standard");

  // Step 3: Movement & Nutrients Goals ("Step and nutrients Goals")
  const [stepsTarget, setStepsTarget] = useState<number>(profile?.dailyStepsTarget || 10000);
  const [calorieTarget, setCalorieTarget] = useState<number>(profile?.dailyCalorieTarget || 2100);
  const [proteinTarget, setProteinTarget] = useState<number>(profile?.dailyProteinTarget || 120);
  const [sleepTargetHours, setSleepTargetHours] = useState<number>(
    profile?.dailySleepTargetHours ? Number(profile.dailySleepTargetHours) : 8.0
  );
  const [screenLimitMinutes, setScreenLimitMinutes] = useState<number>(
    profile?.dailyScreenTimeLimitMinutes || 180
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Prefill name from Google or verified email
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

  // Adjust calorie and protein defaults when weight/height changes
  useEffect(() => {
    const isMale = gender === "Male";
    const baseCals = isMale ? Math.round(weightVal * 28 + 350) : Math.round(weightVal * 26 + 200);
    const baseProtein = Math.round(weightVal * 1.6);
    setCalorieTarget(Math.max(1600, Math.min(3200, baseCals)));
    setProteinTarget(Math.max(70, Math.min(200, baseProtein)));
  }, [weightVal, gender]);

  // Navigation handlers
  const handleBack = () => {
    triggerHaptic();
    if (currentStep === 1) {
      router.back();
    } else if (currentStep === 2) {
      setCurrentStep(1);
    } else {
      setCurrentStep(2);
    }
  };

  const handleNextStep = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (currentStep === 1) {
      if (!name.trim()) {
        Alert.alert("Name Required", "Please enter your name to personalize your bio-profile.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else {
      handleCompleteSetup();
    }
  };

  // Final submission and save
  const handleCompleteSetup = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSubmitting(true);

    const profilePayload = {
      name: name.trim() || "User",
      mode: selectedMode,
      dailyCalorieTarget: calorieTarget,
      dailyProteinTarget: proteinTarget,
      dailyStepsTarget: stepsTarget,
      dailySleepTargetHours: sleepTargetHours,
      dailyScreenTimeLimitMinutes: screenLimitMinutes,
      onboardingComplete: true,
    };

    // Guarantee local persistence
    await storage.setItem("lumen_auth_token", "authenticated");
    await storage.setItem("lumen_onboarding_completed", "true");
    await storage.removeItem("lumen_in_onboarding");
    await storage.setItem(
      "lumen_personal_details",
      JSON.stringify({
        name: name.trim(),
        gender,
        weight: weightVal,
        weightUnit,
        height: heightVal,
        heightUnit,
        mode: selectedMode,
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
      {/* Top Header Row with Back Button & 3-Step Progress Indicator */}
      <View style={styles.topBar}>
        <Pressable style={styles.backCircleBtn} onPress={handleBack} accessibilityLabel="Back">
          <ChevronLeft size={20} color="#ffffff" strokeWidth={2.4} />
        </Pressable>

        <View style={styles.stepperCenterBox}>
          <Text style={styles.stepperTitleText}>STEP {currentStep} OF 3</Text>
          <View style={styles.stepperPillsRow}>
            <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]} />
            <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]} />
            <View style={[styles.stepDot, currentStep >= 3 && styles.stepDotActive]} />
          </View>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ========================================================= */}
        {/* STEP 1: PERSONAL INFORMATION                              */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <View>
            <View style={styles.titleSection}>
              <Text style={styles.screenTitle}>Personal Information</Text>
              <Text style={styles.screenSubtitle}>
                Provide required information to customize your biometrics
              </Text>
            </View>

            {/* Name Input */}
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

            {/* Gender & Weight Row */}
            <View style={styles.rowFields}>
              {/* Gender Dropdown Pill */}
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <Pressable
                  style={styles.capsulePillBtn}
                  onPress={() => {
                    triggerHaptic();
                    setIsGenderDropdownOpen(!isGenderDropdownOpen);
                  }}
                >
                  <Text style={styles.capsulePillText} numberOfLines={1}>
                    {gender}
                  </Text>
                  {isGenderDropdownOpen ? (
                    <ChevronUp size={16} color="#8ea69b" />
                  ) : (
                    <ChevronDown size={16} color="#8ea69b" />
                  )}
                </Pressable>

                {isGenderDropdownOpen && (
                  <View style={styles.genderDropdownCard}>
                    {(["Male", "Female"] as const).map((g) => (
                      <Pressable
                        key={g}
                        style={[
                          styles.genderDropdownItem,
                          gender === g && styles.genderDropdownItemActive,
                        ]}
                        onPress={() => {
                          triggerHaptic();
                          setGender(g);
                          setIsGenderDropdownOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.genderItemText,
                            gender === g && styles.genderItemTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                        {gender === g && <Check size={14} color="#d4f933" strokeWidth={2.8} />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Weight Pill Button (Tapping opens sliding ruler modal) */}
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Weight</Text>
                <Pressable
                  style={styles.capsulePillBtn}
                  onPress={() => {
                    triggerHaptic();
                    setShowWeightModal(true);
                  }}
                >
                  <Text style={styles.capsulePillText} numberOfLines={1}>
                    {weightVal} {weightUnit.toLowerCase()}
                  </Text>
                  <ChevronRight size={16} color="#8ea69b" />
                </Pressable>
              </View>
            </View>

            {/* Height Pill Button (Tapping opens sliding ruler modal) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Height</Text>
              <Pressable
                style={styles.capsulePillBtn}
                onPress={() => {
                  triggerHaptic();
                  setShowHeightModal(true);
                }}
              >
                <Text style={styles.capsulePillText} numberOfLines={1}>
                  {heightVal} {heightUnit.toLowerCase()}
                </Text>
                <ChevronRight size={16} color="#8ea69b" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* STEP 2: HEALTH & MEDICAL PROTOCOL FOCUS ("Diseases part")  */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <View>
            <View style={styles.titleSection}>
              <Text style={styles.screenTitle}>Health & Medical Protocol</Text>
              <Text style={styles.screenSubtitle}>
                Select your primary health condition or longevity focus for specialized AI guidance
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              {HEALTH_MODES.map((hm) => {
                const isSelected = selectedMode === hm.id;
                return (
                  <Pressable
                    key={hm.id}
                    style={[
                      styles.healthModeCard,
                      isSelected && styles.healthModeCardSelected,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedMode(hm.id);
                    }}
                  >
                    <View style={styles.healthModeTopRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <Text style={styles.healthModeIcon}>{hm.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.healthModeTitle, isSelected && { color: "#ffffff" }]}>
                            {hm.title}
                          </Text>
                          <Text style={styles.healthModeBadge}>{hm.badge}</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && styles.radioCircleSelected,
                        ]}
                      >
                        {isSelected && <Check size={12} color="#0b120f" strokeWidth={3.5} />}
                      </View>
                    </View>

                    <Text style={styles.healthModeDesc}>{hm.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* STEP 3: MOVEMENT & NUTRIENT GOALS ("Steps & Nutrients")   */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <View>
            <View style={styles.titleSection}>
              <Text style={styles.screenTitle}>Movement & Nutrient Goals</Text>
              <Text style={styles.screenSubtitle}>
                Calibrated to your biological profile. Adjust your daily targets below.
              </Text>
            </View>

            <View style={{ gap: 14 }}>
              {/* 1. Daily Steps */}
              <GoalSliderCard
                icon={<Footprints size={18} color="#047857" />}
                title="Daily Steps Target"
                value={stepsTarget}
                unit="steps"
                min={3000}
                max={20000}
                step={500}
                presets={[6000, 8000, 10000, 12000, 15000]}
                onChange={setStepsTarget}
              />

              {/* 2. Daily Calories */}
              <GoalSliderCard
                icon={<Utensils size={18} color="#b45309" />}
                title="Daily Caloric Intake"
                value={calorieTarget}
                unit="kcal"
                min={1400}
                max={3500}
                step={50}
                presets={[1800, 2000, 2200, 2500]}
                onChange={setCalorieTarget}
              />

              {/* 3. Daily Protein */}
              <GoalSliderCard
                icon={<Sparkles size={18} color="#d4f933" />}
                title="Protein Target"
                value={proteinTarget}
                unit="g"
                min={50}
                max={220}
                step={5}
                presets={[80, 100, 120, 140, 160]}
                onChange={setProteinTarget}
              />

              {/* 4. Daily Sleep */}
              <GoalSliderCard
                icon={<Moon size={18} color="#4338ca" />}
                title="Sleep Duration"
                value={sleepTargetHours}
                unit="hrs"
                min={6.0}
                max={10.0}
                step={0.5}
                presets={[7.0, 7.5, 8.0, 8.5, 9.0]}
                onChange={setSleepTargetHours}
              />

              {/* 5. Screen Time Limit */}
              <GoalSliderCard
                icon={<Smartphone size={18} color="#0284c7" />}
                title="Mindful Screen Time Limit"
                value={screenLimitMinutes}
                unit="m"
                min={60}
                max={360}
                step={15}
                presets={[120, 180, 240, 300]}
                onChange={setScreenLimitMinutes}
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Pinned Vibrant Lime Action Button */}
      <View style={styles.bottomFooter}>
        <Pressable
          style={({ pressed }) => [
            styles.nextVibrantBtn,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            isSubmitting && { opacity: 0.7 },
          ]}
          onPress={handleNextStep}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#0b1410" />
          ) : (
            <Text style={styles.nextVibrantBtnText}>
              {currentStep === 3 ? "Complete Setup & Launch ➔" : "Next"}
            </Text>
          )}
        </Pressable>
      </View>

      {/* ========================================================= */}
      {/* WEIGHT SLIDING RULER MODAL                                */}
      {/* ========================================================= */}
      <InteractiveRulerModal
        visible={showWeightModal}
        title="Set Weight"
        value={weightVal}
        min={weightUnit === "KG" ? 35 : 75}
        max={weightUnit === "KG" ? 200 : 440}
        step={1}
        unit={weightUnit}
        onToggleUnit={() => {
          triggerHaptic();
          if (weightUnit === "KG") {
            setWeightUnit("LBS");
            setWeightVal(Math.round(weightVal * 2.20462));
          } else {
            setWeightUnit("KG");
            setWeightVal(Math.round(weightVal / 2.20462));
          }
        }}
        presets={weightUnit === "KG" ? [60, 70, 75, 80, 85, 95] : [135, 155, 165, 175, 190]}
        onChange={setWeightVal}
        onConfirm={() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          setShowWeightModal(false);
        }}
        onClose={() => setShowWeightModal(false)}
      />

      {/* ========================================================= */}
      {/* HEIGHT SLIDING RULER MODAL                                */}
      {/* ========================================================= */}
      <InteractiveRulerModal
        visible={showHeightModal}
        title="Set Height"
        value={heightVal}
        min={heightUnit === "Cm" ? 110 : 3}
        max={heightUnit === "Cm" ? 230 : 8}
        step={1}
        unit={heightUnit}
        onToggleUnit={() => {
          triggerHaptic();
          setHeightUnit(heightUnit === "Cm" ? "Ft" : "Cm");
        }}
        presets={heightUnit === "Cm" ? [160, 165, 170, 175, 180, 185] : [5, 6]}
        onChange={setHeightVal}
        onConfirm={() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          setShowHeightModal(false);
        }}
        onClose={() => setShowHeightModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b120f", // Sleek dark charcoal background matching reference video
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  topBar: {
    paddingHorizontal: 22,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  stepperCenterBox: {
    alignItems: "center",
    gap: 5,
  },
  stepperTitleText: {
    color: "#7e978b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  stepperPillsRow: {
    flexDirection: "row",
    gap: 6,
  },
  stepDot: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  stepDotActive: {
    backgroundColor: "#d4f933",
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 120,
  },
  titleSection: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 27,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 13,
    color: "#7e978b",
    marginTop: 6,
    lineHeight: 18,
  },
  fieldBlock: {
    marginBottom: 16,
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
    marginBottom: 16,
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

  // Gender Dropdown
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

  // Step 2: Health Mode / Diseases Cards
  healthModeCard: {
    backgroundColor: "#131e18",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
  },
  healthModeCardSelected: {
    borderColor: "#d4f933",
    backgroundColor: "rgba(212, 249, 51, 0.06)",
    shadowColor: "#d4f933",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  healthModeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  healthModeIcon: {
    fontSize: 22,
  },
  healthModeTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#dbeae3",
  },
  healthModeBadge: {
    fontSize: 10,
    color: "#7e978b",
    fontWeight: "700",
    marginTop: 1,
  },
  healthModeDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: "#9cb6ab",
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    backgroundColor: "#d4f933",
    borderColor: "#d4f933",
  },

  // Step 3: Goals Stepper Cards
  goalCard: {
    backgroundColor: "#131e18",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 12,
  },
  goalCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  goalValueText: {
    color: "#d4f933",
    fontSize: 17,
    fontWeight: "900",
  },
  goalUnitText: {
    color: "#7e978b",
    fontSize: 11,
    fontWeight: "700",
  },
  stepperBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalMinusPlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  goalTrackContainer: {
    flex: 1,
    height: 24,
    justifyContent: "center",
  },
  goalTrackBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
  },
  goalTrackFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d4f933",
  },
  goalTrackKnob: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#d4f933",
  },
  goalPresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
  },
  goalPresetPill: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
  },
  goalPresetPillSelected: {
    backgroundColor: "rgba(212, 249, 51, 0.18)",
    borderColor: "#d4f933",
  },
  goalPresetText: {
    color: "#8ea69b",
    fontSize: 11,
    fontWeight: "700",
  },
  goalPresetTextSelected: {
    color: "#d4f933",
    fontWeight: "800",
  },

  // Bottom Footer
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
    backgroundColor: "#d4f933", // Electric Lime
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

  // Ruler Modal Styles (Interactive Sliding Ruler)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 10, 8, 0.8)",
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
    marginBottom: 14,
  },
  rulerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
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
  valueBubbleContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  valueBubble: {
    backgroundColor: "#d4f933",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    shadowColor: "#d4f933",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  valueBubbleText: {
    color: "#0b1410",
    fontSize: 22,
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
  },
  rulerDragWrapper: {
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 10,
  },
  stepperRulerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  rulerStepArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    gap: 6,
    height: 64,
    paddingHorizontal: 4,
  },
  tickItem: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 18,
  },
  tickBar: {
    borderRadius: 2,
  },
  tickBarCenter: {
    width: 3.5,
    height: 40,
    backgroundColor: "#d4f933",
    shadowColor: "#d4f933",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  tickBarMajor: {
    width: 2.2,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
  },
  tickBarMinor: {
    width: 1.4,
    height: 16,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  tickNumberText: {
    color: "#7e978b",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },
  tickNumberCenter: {
    color: "#d4f933",
    fontWeight: "900",
  },
  rulerSlideHint: {
    color: "#6b8377",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  rulerPresetsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  rulerPresetPill: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  rulerPresetPillActive: {
    backgroundColor: "rgba(212, 249, 51, 0.18)",
    borderColor: "#d4f933",
  },
  rulerPresetText: {
    color: "#8ea69b",
    fontSize: 12,
    fontWeight: "700",
  },
  rulerPresetTextActive: {
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
