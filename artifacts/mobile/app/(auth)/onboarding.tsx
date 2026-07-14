import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { User, Flame, Sparkles, Moon, Clock, Trophy, ChevronRight, Check } from "lucide-react-native";

const healthModes = [
  { id: "standard", label: "Standard Health", icon: "🌱", desc: "Energy & wellbeing." },
  { id: "diabetes", label: "Diabetes Care", icon: "🩸", desc: "Blood glucose monitoring." },
  { id: "heart_health", label: "Heart Health", icon: "❤️", desc: "Cardio endurance & vitals." },
  { id: "weight_loss", label: "Weight Loss", icon: "⚖️", desc: "Deficits & macros." },
  { id: "pregnancy", label: "Pregnancy Focus", icon: "🤰", desc: "Prenatal nutrition." },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const updateProfile = useUpdateProfile();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(profile?.name || "");
  const [mode, setMode] = useState(profile?.mode || "standard");
  const [calories, setCalories] = useState(2100);
  const [protein, setProtein] = useState(110);
  const [steps, setSteps] = useState(9000);
  const [sleep, setSleep] = useState(8);
  const [screenTime, setScreenTime] = useState(180);

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
    try {
      await updateProfile.mutateAsync({
        data: {
          name,
          mode,
          dailyCalorieTarget: calories,
          dailyProteinTarget: protein,
          dailyStepsTarget: steps,
          dailySleepTargetHours: sleep,
          dailyScreenTimeLimitMinutes: screenTime,
          onboardingComplete: true
        }
      });
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      router.replace("/(tabs)");
    } catch {
      alert("Failed to initialize profile. Please try again.");
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

            <View style={styles.sliderCard}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderTitle}>Daily Calories Target</Text>
                <Text style={styles.sliderVal}>{calories} kcal</Text>
              </View>
              <View style={styles.sliderInputGroup}>
                <Pressable onPress={() => setCalories(prev => Math.max(1200, prev - 100))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.stepLabel}>Adjustment</Text>
                <Pressable onPress={() => setCalories(prev => Math.min(4000, prev + 100))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sliderCard}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderTitle}>Daily Protein Target</Text>
                <Text style={styles.sliderVal}>{protein}g</Text>
              </View>
              <View style={styles.sliderInputGroup}>
                <Pressable onPress={() => setProtein(prev => Math.max(40, prev - 10))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.stepLabel}>Adjustment</Text>
                <Pressable onPress={() => setProtein(prev => Math.min(250, prev + 10))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Daily Active Targets.</Text>
            <Text style={styles.stepDesc}>Define targets for physical movements and screen limits.</Text>

            <View style={styles.sliderCard}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderTitle}>Daily Steps Target</Text>
                <Text style={styles.sliderVal}>{steps.toLocaleString()}</Text>
              </View>
              <View style={styles.sliderInputGroup}>
                <Pressable onPress={() => setSteps(prev => Math.max(3000, prev - 1000))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.stepLabel}>Adjustment</Text>
                <Pressable onPress={() => setSteps(prev => Math.min(25000, prev + 1000))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sliderCard}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderTitle}>Sleep Hours Target</Text>
                <Text style={styles.sliderVal}>{sleep} hrs</Text>
              </View>
              <View style={styles.sliderInputGroup}>
                <Pressable onPress={() => setSleep(prev => Math.max(5, prev - 1))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.stepLabel}>Adjustment</Text>
                <Pressable onPress={() => setSleep(prev => Math.min(12, prev + 1))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sliderCard}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderTitle}>Screen Time Limit</Text>
                <Text style={styles.sliderVal}>{screenTime} min</Text>
              </View>
              <View style={styles.sliderInputGroup}>
                <Pressable onPress={() => setScreenTime(prev => Math.max(30, prev - 30))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>-</Text>
                </Pressable>
                <Text style={styles.stepLabel}>Adjustment</Text>
                <Pressable onPress={() => setScreenTime(prev => Math.min(480, prev + 30))} style={styles.stepBtn}>
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
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
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>{step === 4 ? "Initialize OS" : "Next"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
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
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  stepperPage: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "bold",
  },
  stepperBarBackground: {
    height: 4,
    backgroundColor: "#1e293b",
    borderRadius: 2,
    overflow: "hidden",
  },
  stepperBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
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
    color: "#f8fafc",
  },
  stepDesc: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
    marginBottom: 10,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    height: 52,
    color: "#f8fafc",
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
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
  },
  modeCardSelected: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  modeIcon: {
    fontSize: 26,
  },
  modeInfo: {
    flex: 1,
  },
  modeLabel: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 14,
  },
  modeDesc: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  sliderCard: {
    backgroundColor: "#0b1310",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 15,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderTitle: {
    color: "#f8fafc",
    fontWeight: "bold",
  },
  sliderVal: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "black",
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
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "bold",
  },
  stepLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 10,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 13,
  },
  summaryVal: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 13,
  },
  footer: {
    height: 90,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingHorizontal: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#050b08",
  },
  backBtn: {
    paddingHorizontal: 20,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    color: "#64748b",
    fontWeight: "bold",
  },
  nextBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 30,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    color: "#050b08",
    fontWeight: "bold",
  },
});
