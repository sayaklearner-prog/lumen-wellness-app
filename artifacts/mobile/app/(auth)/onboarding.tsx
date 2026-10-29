import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import { getStoredGoogleUser } from "@/services/googleAuth";
import { authService } from "@/services/authService";
import { User, Flame, Sparkles, Moon, Clock, Trophy, ChevronRight, Check, Plus, Minus, ShieldCheck } from "lucide-react-native";
import THEME from "@/constants/theme";

const healthModes = [
  { id: "standard", label: "Standard Health", icon: "🌱", desc: "Energy & wellbeing." },
  { id: "diabetes", label: "Diabetes Care", icon: "🩸", desc: "Blood glucose monitoring." },
  { id: "heart_health", label: "Heart Health", icon: "❤️", desc: "Cardio endurance & vitals." },
  { id: "weight_loss", label: "Weight Loss", icon: "⚖️", desc: "Deficits & macros." },
  { id: "pregnancy", label: "Pregnancy Focus", icon: "🤰", desc: "Prenatal nutrition." },
];

interface AdjustmentBarCardProps {
  title: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  presets?: number[];
  onChange: (val: number) => void;
}

function AdjustmentBarCard({
  title,
  value,
  unit,
  min,
  max,
  step,
  presets = [],
  onChange,
}: AdjustmentBarCardProps) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const handleDecrement = () => {
    onChange(Math.max(min, Number((value - step).toFixed(1))));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, Number((value + step).toFixed(1))));
  };

  return (
    <View style={styles.sliderCard}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderTitle}>{title}</Text>
        <Text style={styles.sliderVal}>
          {value.toLocaleString()} {unit}
        </Text>
      </View>

      {/* Visual Adjustment Stepper Track */}
      <View style={styles.sliderInputGroup}>
        <Pressable onPress={handleDecrement} style={styles.stepBtn}>
          <Minus size={18} color="#f8fafc" />
        </Pressable>

        <View style={styles.trackContainer}>
          <View style={styles.trackBg}>
            <View style={[styles.trackFill, { width: `${percentage}%` }]} />
            <View style={[styles.trackKnob, { left: `${Math.max(0, Math.min(94, percentage))}%` }]} />
          </View>
        </View>

        <Pressable onPress={handleIncrement} style={styles.stepBtn}>
          <Plus size={18} color="#10b981" />
        </Pressable>
      </View>

      {/* Min / Max bounds */}
      <View style={styles.boundsRow}>
        <Text style={styles.boundsText}>{min.toLocaleString()} {unit}</Text>
        <Text style={styles.boundsText}>{max.toLocaleString()} {unit}</Text>
      </View>

      {/* Quick Preset Pills */}
      {presets.length > 0 && (
        <View style={styles.presetPillsRow}>
          {presets.map((p, idx) => {
            const isSelected = value === p;
            return (
              <Pressable
                key={idx}
                onPress={() => onChange(p)}
                style={[styles.presetPill, isSelected && styles.presetPillSelected]}
              >
                <Text style={[styles.presetPillText, isSelected && styles.presetPillTextSelected]}>
                  {p.toLocaleString()}
                  {unit === "kcal" ? "" : unit === "min" ? "m" : unit === "hrs" ? "h" : unit === "g" ? "g" : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const updateProfile = useUpdateProfile();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(profile?.name || "");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [mode, setMode] = useState(profile?.mode || "standard");
  const [calories, setCalories] = useState(2100);
  const [protein, setProtein] = useState(110);
  const [steps, setSteps] = useState(9000);
  const [sleep, setSleep] = useState(8);
  const [screenTime, setScreenTime] = useState(180);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      if (profile.name && !name) setName(profile.name);
      if (profile.mode) setMode(profile.mode);
      if (profile.dailyCalorieTarget) setCalories(profile.dailyCalorieTarget);
      if (profile.dailyProteinTarget) setProtein(profile.dailyProteinTarget);
      if (profile.dailyStepsTarget) setSteps(profile.dailyStepsTarget);
      if (profile.dailySleepTargetHours) setSleep(Number(profile.dailySleepTargetHours));
      if (profile.dailyScreenTimeLimitMinutes) setScreenTime(profile.dailyScreenTimeLimitMinutes);
    }
  }, [profile]);

  useEffect(() => {
    async function loadIdentitySession() {
      try {
        const vEmail = await authService.getVerifiedEmail();
        if (vEmail) {
          setVerifiedEmail(vEmail);
          if (!name) {
            const prefix = vEmail.split("@")[0].replace(/[._-]/g, " ");
            setName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        }
        const gUser = await getStoredGoogleUser();
        if (gUser) {
          if (gUser.name && !name) setName(gUser.name);
          if (gUser.email && !vEmail) setVerifiedEmail(gUser.email);
        }
      } catch {}
    }
    loadIdentitySession();
  }, []);

  const handleNext = () => {
    if (step === 1 && !name.trim()) {
      alert("Please enter your name");
      return;
    }
    if (step < 4) {
      setStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const profilePayload = {
      name: name.trim() || "User",
      mode,
      dailyCalorieTarget: calories,
      dailyProteinTarget: protein,
      dailyStepsTarget: steps,
      dailySleepTargetHours: sleep,
      dailyScreenTimeLimitMinutes: screenTime,
      onboardingComplete: true,
    };

    // Guarantee local authentication and onboarding flags are saved immediately
    await storage.setItem("lumen_auth_token", "authenticated");
    await storage.setItem("lumen_onboarding_completed", "true");
    await storage.removeItem("lumen_in_onboarding");
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
      console.warn("Backend profile save postponed (offline/cold start):", err?.message);
      // Still navigate cleanly since local state is completely saved
      router.replace("/(tabs)");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Timeline stepper */}
      <View style={styles.stepperContainer}>
        <View style={styles.stepperHeader}>
          <Text style={styles.stepperSub}>Lumen OS setup</Text>
          <Text style={styles.stepperPage}>Step {step} of 4</Text>
        </View>
        <View style={styles.stepperBarBackground}>
          <View style={[styles.stepperBarFill, { width: `${(step / 4) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <View style={styles.stepContainer}>
            {verifiedEmail ? (
              <View style={styles.verifiedBannerCard}>
                <View style={styles.verifiedBadgeRow}>
                  <View style={styles.verifiedIconBox}>
                    <ShieldCheck size={16} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifiedBadgeTitle}>EMAIL VERIFIED</Text>
                    <Text style={styles.verifiedBadgeEmail}>{verifiedEmail}</Text>
                  </View>
                </View>
                <Text style={styles.verifiedBadgeDesc}>
                  Your email has been authenticated via one-time code. Complete your personal health profile below.
                </Text>
              </View>
            ) : null}

            <Text style={styles.stepTitle}>Let's initialize your bio-profile.</Text>
            <Text style={styles.stepDesc}>What is your name and main wellness focus?</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Your Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Liam Mercer"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Target Wellness Mode</Text>
              <View style={styles.modesList}>
                {healthModes.map(m => (
                  <Pressable
                    key={m.id}
                    style={[styles.modeCard, mode === m.id && styles.modeCardSelected]}
                    onPress={() => setMode(m.id)}
                  >
                    <Text style={styles.modeIcon}>{m.icon}</Text>
                    <View style={styles.modeInfo}>
                      <Text style={styles.modeLabel}>{m.label}</Text>
                      <Text style={styles.modeDesc}>{m.desc}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Nutritional parameters.</Text>
            <Text style={styles.stepDesc}>These values configure your nutrition target bars and coaches guidelines.</Text>

            <AdjustmentBarCard
              title="Daily Calories Target"
              value={calories}
              unit="kcal"
              min={1200}
              max={4000}
              step={100}
              presets={[1800, 2100, 2500, 3000]}
              onChange={setCalories}
            />

            <AdjustmentBarCard
              title="Daily Protein Target"
              value={protein}
              unit="g"
              min={40}
              max={250}
              step={10}
              presets={[80, 110, 140, 180]}
              onChange={setProtein}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Daily Active Targets.</Text>
            <Text style={styles.stepDesc}>Define targets for physical movements and screen limits.</Text>

            <AdjustmentBarCard
              title="Daily Steps Target"
              value={steps}
              unit="steps"
              min={3000}
              max={25000}
              step={1000}
              presets={[6000, 8000, 10000, 12000]}
              onChange={setSteps}
            />

            <AdjustmentBarCard
              title="Sleep Hours Target"
              value={sleep}
              unit="hrs"
              min={5}
              max={12}
              step={0.5}
              presets={[7, 7.5, 8, 8.5]}
              onChange={setSleep}
            />

            <AdjustmentBarCard
              title="Screen Time Limit"
              value={screenTime}
              unit="min"
              min={30}
              max={480}
              step={30}
              presets={[60, 90, 120, 180]}
              onChange={setScreenTime}
            />
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Review & Confirm</Text>
            <Text style={styles.stepDesc}>Review parameters before deploying to your device database.</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Name</Text>
                <Text style={styles.summaryVal}>{name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Focus Mode</Text>
                <Text style={styles.summaryVal}>{mode}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Daily Calories</Text>
                <Text style={styles.summaryVal}>{calories} kcal</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Daily Protein</Text>
                <Text style={styles.summaryVal}>{protein}g</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Steps Target</Text>
                <Text style={styles.summaryVal}>{steps.toLocaleString()} steps</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Sleep Target</Text>
                <Text style={styles.summaryVal}>{sleep} hrs</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Screen Limit</Text>
                <Text style={styles.summaryVal}>{screenTime} min</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Stepper Footer Action Buttons */}
      <View style={styles.footer}>
        {step > 1 ? (
          <Pressable style={styles.backBtn} onPress={() => setStep(prev => prev - 1)}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable 
          style={[styles.nextBtn, isSubmitting && { opacity: 0.6 }]} 
          onPress={handleNext}
          disabled={isSubmitting}
        >
          <Text style={styles.nextBtnText}>
            {step === 4 ? (isSubmitting ? "Initializing..." : "Initialize OS") : "Next"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  stepperContainer: {
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  stepperHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  stepperSub: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  stepperPage: {
    color: THEME.colors.accentGreen,
    fontSize: 12,
    fontWeight: "bold",
  },
  stepperBarBackground: {
    height: 4,
    backgroundColor: "rgba(232, 241, 237, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  stepperBarFill: {
    height: "100%",
    backgroundColor: THEME.colors.accentGreen,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  stepContainer: {
    gap: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  stepDesc: {
    fontSize: 14,
    color: THEME.colors.textOnDarkSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 16,
    height: 52,
    color: THEME.colors.cardTextPrimary,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  modesList: {
    gap: 10,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 20,
    padding: 16,
    ...THEME.shadows.cardLight,
  },
  modeCardSelected: {
    borderColor: THEME.colors.accentGreen,
    borderWidth: 2,
    backgroundColor: "#ffffff",
  },
  modeIcon: {
    fontSize: 26,
  },
  modeInfo: {
    flex: 1,
  },
  modeLabel: {
    color: THEME.colors.cardTextPrimary,
    fontWeight: "bold",
    fontSize: 15,
  },
  modeDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  sliderCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 15,
    ...THEME.shadows.card,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderTitle: {
    color: THEME.colors.cardTextPrimary,
    fontWeight: "bold",
    fontSize: 15,
  },
  sliderVal: {
    color: THEME.colors.accentGreen,
    fontSize: 20,
    fontWeight: "900",
  },
  sliderInputGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 20,
    fontWeight: "bold",
  },
  stepLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
  },
  trackContainer: {
    flex: 1,
    marginHorizontal: 10,
    height: 24,
    justifyContent: "center",
  },
  trackBg: {
    height: 8,
    backgroundColor: "rgba(180, 205, 195, 0.45)",
    borderRadius: 4,
    position: "relative",
    justifyContent: "center",
  },
  trackFill: {
    height: 8,
    backgroundColor: THEME.colors.accentGreen,
    borderRadius: 4,
  },
  trackKnob: {
    position: "absolute",
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: THEME.colors.accentGreen,
    borderWidth: 2,
    borderColor: "#ffffff",
    elevation: 4,
  },
  boundsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 54,
    marginTop: -4,
  },
  boundsText: {
    color: THEME.colors.cardTextTertiary,
    fontSize: 11,
    fontWeight: "500",
  },
  presetPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  presetPillSelected: {
    borderColor: THEME.colors.accentGreen,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  presetPillText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  presetPillTextSelected: {
    color: THEME.colors.accentGreen,
    fontWeight: "bold",
  },
  summaryCard: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    ...THEME.shadows.card,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.4)",
    paddingBottom: 10,
  },
  summaryLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 13,
  },
  summaryVal: {
    color: THEME.colors.cardTextPrimary,
    fontWeight: "bold",
    fontSize: 13,
  },
  footer: {
    height: 90,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 218, 210, 0.2)",
    paddingHorizontal: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(19, 34, 29, 0.98)",
  },
  backBtn: {
    paddingHorizontal: 20,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    color: THEME.colors.textOnDarkSecondary,
    fontWeight: "bold",
  },
  nextBtn: {
    backgroundColor: THEME.colors.accentGreen,
    paddingHorizontal: 32,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  verifiedBannerCard: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    gap: 8,
    marginBottom: 14,
  },
  verifiedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  verifiedIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadgeTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.accentGreen,
    letterSpacing: 0.8,
  },
  verifiedBadgeEmail: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.textOnDarkPrimary,
  },
  verifiedBadgeDesc: {
    fontSize: 11,
    color: THEME.colors.textOnDarkSecondary,
    lineHeight: 16,
  },
});
