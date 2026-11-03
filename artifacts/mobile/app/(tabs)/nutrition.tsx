import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import {
  useListMeals,
  useCreateMeal,
  useDeleteMeal,
  useRecognizeFood,
  useGetProfile,
  useUpdateProfile,
  getListMealsQueryKey,
  getGetTodayDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Camera,
  Sparkles,
  Check,
  Apple,
  Flame,
  Image as ImageIcon,
  X,
  Sliders,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Target,
  Dumbbell,
  Droplet,
  Menu,
  Scan,
  RefreshCw,
  Clock,
  Layers,
} from "lucide-react-native";
import { queueOfflineLog, getMeals, saveMeal, deleteMeal, MealRecord } from "@/services/db";
import { storage } from "@/services/storage";
import { useSlideMenu } from "@/context/SlideMenuContext";
import THEME from "@/constants/theme";
import { AmbientAtmosphere } from "@/components/AmbientAtmosphere";
import {
  analyzeFoodImageWithGemini,
  getGeminiApiKey,
  isValidGeminiApiKey,
} from "@/services/geminiAi";

export default function NutritionScreen() {
  const qc = useQueryClient();
  const { openLeftMenu, openMenu } = useSlideMenu();
  const { data: profile } = useGetProfile();
  const updateProfileMutation = useUpdateProfile();

  // Targets (default 2,000 kcal and 130g protein, customizable by user)
  const [calorieTarget, setCalorieTarget] = useState<number>(2000);
  const [proteinTarget, setProteinTarget] = useState<number>(130);
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [tempCalTarget, setTempCalTarget] = useState<string>("2000");
  const [tempProTarget, setTempProTarget] = useState<string>("130");

  // Meal list & log form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [mealType, setMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const [localMeals, setLocalMeals] = useState<Array<MealRecord>>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [vitamins, setVitamins] = useState("");

  // AI Food Vision Scanner States
  const [showScanModal, setShowScanModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    name: string;
    mealType: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    vitamins: string;
    items?: Array<{ name: string; quantity?: string; portion?: string; calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number }>;
    notes?: string;
    confidence?: number;
  } | null>(null);

  const cameraInputRef = useRef<any>(null);
  const galleryInputRef = useRef<any>(null);
  const recognizeFoodMutation = useRecognizeFood();
  const { data: meals } = useListMeals();
  const createMealMutation = useCreateMeal();
  const deleteMealMutation = useDeleteMeal();

  // Load custom targets from storage / profile
  useEffect(() => {
    async function initTargets() {
      try {
        const storedCal = await storage.getItem("lumen_calorie_target");
        const storedPro = await storage.getItem("lumen_protein_target");

        if (storedCal) {
          const val = parseInt(storedCal, 10);
          if (val > 0) setCalorieTarget(val);
        } else if (profile?.dailyCalorieTarget && profile.dailyCalorieTarget > 0) {
          setCalorieTarget(profile.dailyCalorieTarget);
        }

        if (storedPro) {
          const val = parseInt(storedPro, 10);
          if (val > 0) setProteinTarget(val);
        } else if (profile?.dailyProteinTarget && profile.dailyProteinTarget > 0) {
          setProteinTarget(profile.dailyProteinTarget);
        }
      } catch (err) {
        console.warn("Could not load nutrient targets:", err);
      }
    }
    initTargets();
  }, [profile]);

  // Load locally saved meals from master SQLite database & purge any legacy dummy mock data
  useEffect(() => {
    async function loadCachedMeals() {
      try {
        const isMockMeal = (m: any) =>
          m &&
          (m.name === "Avocado Sourdough Toast & Poached Egg" ||
            m.name === "Avocado Toast & Poached Egg" ||
            m.name === "Grilled Chicken & Brown Rice Bowl" ||
            m.name === "Wild Atlantic Salmon & Quinoa" ||
            m.name === "Whey Protein Super Smoothie" ||
            m.id === "meal-scan-mock");

        const dbMeals = await getMeals();
        if (dbMeals && dbMeals.length > 0) {
          const cleaned = dbMeals.filter((m) => !isMockMeal(m));
          setLocalMeals(cleaned);
          if (cleaned.length !== dbMeals.length) {
            await storage.setItem("lumen_local_meals", JSON.stringify(cleaned));
          }
          return;
        }

        const raw = await storage.getItem("lumen_local_meals");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((m) => !isMockMeal(m));
            setLocalMeals(cleaned);
            if (cleaned.length !== parsed.length) {
              await storage.setItem("lumen_local_meals", JSON.stringify(cleaned));
            }
          }
        }
      } catch (err) {
        console.warn("Could not load cached meals:", err);
      }
    }
    loadCachedMeals();
  }, []);

  // Save updated goals
  const handleSaveTargets = async () => {
    const newCal = parseInt(tempCalTarget, 10) || 2000;
    const newPro = parseInt(tempProTarget, 10) || 130;
    setCalorieTarget(newCal);
    setProteinTarget(newPro);
    setShowTargetModal(false);

    try {
      await storage.setItem("lumen_calorie_target", String(newCal));
      await storage.setItem("lumen_protein_target", String(newPro));
      await updateProfileMutation.mutateAsync({
        data: {
          dailyCalorieTarget: newCal,
          dailyProteinTarget: newPro,
        } as any,
      });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
    } catch (err) {
      console.warn("Saved goals locally:", err);
    }
  };

  // Open targets modal with current values
  const handleOpenTargetsModal = () => {
    setTempCalTarget(String(calorieTarget));
    setTempProTarget(String(proteinTarget));
    setShowTargetModal(true);
  };

  // Process food photo with AI Vision (NO prewritten fallback mock data)
  const processImageForNutrition = async (uri: string, base64?: string | null) => {
    setSelectedImageUri(uri);
    setIsScanning(true);
    setScanResult(null);

    const payload = base64 || uri;

    try {
      // 1. Direct on-device Google Gemini Vision
      const geminiKey = await getGeminiApiKey();
      if (geminiKey && isValidGeminiApiKey(geminiKey)) {
        try {
          const directResult = await analyzeFoodImageWithGemini(payload, "healthy meal analysis");
          setScanResult(directResult);
          return;
        } catch (visionErr: any) {
          console.warn("Direct Gemini Vision attempt failed, falling back to backend:", visionErr);
        }
      }

      // 2. Secondary: Backend server route
      const res: any = await recognizeFoodMutation.mutateAsync({
        data: {
          image: payload,
          imageBase64: payload,
          hint: "healthy meal analysis",
        } as any,
      });

      if (res && (res.name || res.mealName)) {
        const recognized = {
          name: res.name || res.mealName || "Detected Meal",
          mealType: res.mealType || res.suggestedMealType || "lunch",
          calories: Number(res.calories ?? res.totalCalories ?? 0),
          proteinGrams: Number(res.proteinGrams ?? res.totalProteinGrams ?? 0),
          carbsGrams: Number(res.carbsGrams ?? res.totalCarbsGrams ?? 0),
          fatGrams: Number(res.fatGrams ?? res.totalFatGrams ?? 0),
          vitamins: res.vitamins || "Micronutrients identified",
          items: Array.isArray(res.items) ? res.items : [],
          notes: res.notes || res.modelNotes || "Calibrated via Lumen Computer Vision.",
          confidence: Number(res.confidence ?? 0.94),
        };
        setScanResult(recognized);
      } else {
        throw new Error("Unable to identify food contents from this image.");
      }
    } catch (err: any) {
      console.warn("Food scan recognition error:", err);
      const geminiKey = await getGeminiApiKey();
      const hasKey = geminiKey && isValidGeminiApiKey(geminiKey);
      Alert.alert(
        "Scanning Notice",
        hasKey
          ? `Could not analyze food photo (${err?.message || "Please take a clearer photo in good lighting"}).`
          : "AI Food Scanning requires a Gemini API key. Please configure your free Google Gemini API key in Coach settings to enable instant food scanning.",
        [{ text: "OK" }]
      );
      setScanResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  // 1. Take photo with camera
  const handleTakePhoto = async () => {
    if (Platform.OS === "web") {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to photograph your meal.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await processImageForNutrition(asset.uri, asset.base64);
      }
    } catch (err: any) {
      console.warn("Camera error:", err);
      Alert.alert("Camera Error", err?.message || "Could not open camera");
    }
  };

  // 2. Pick photo from phone gallery
  const handlePickFromGallery = async () => {
    if (Platform.OS === "web") {
      if (galleryInputRef.current) {
        galleryInputRef.current.click();
      }
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Gallery permission is required to select food photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await processImageForNutrition(asset.uri, asset.base64);
      }
    } catch (err: any) {
      console.warn("Gallery error:", err);
      Alert.alert("Gallery Error", err?.message || "Could not open photo gallery");
    }
  };

  // Web / Capacitor file input change handler
  const handleWebFileChange = (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        processImageForNutrition(dataUrl, dataUrl);
      };
      reader.readAsDataURL(file);
    }
    try {
      e.target.value = "";
    } catch {}
  };

  // 1-Tap Log Scanned Meal
  const handleCommitScannedMeal = async () => {
    if (!scanResult) return;
    const scannedMeal: MealRecord = {
      id: `meal-scan-${Date.now()}`,
      name: scanResult.name,
      mealType: scanResult.mealType,
      calories: scanResult.calories,
      proteinGrams: scanResult.proteinGrams,
      carbsGrams: scanResult.carbsGrams,
      fatGrams: scanResult.fatGrams,
      vitamins: scanResult.vitamins,
      items: scanResult.items || [],
      photoUrl: selectedImageUri || undefined,
      source: "ai_camera",
      loggedAt: new Date().toISOString(),
    };

    await saveMeal(scannedMeal);
    const updated = [scannedMeal, ...localMeals];
    setLocalMeals(updated);
    await storage.setItem("lumen_local_meals", JSON.stringify(updated));

    try {
      await createMealMutation.mutateAsync({
        data: {
          name: scanResult.name,
          mealType: scanResult.mealType,
          calories: scanResult.calories,
          proteinGrams: scanResult.proteinGrams,
          carbsGrams: scanResult.carbsGrams,
          fatGrams: scanResult.fatGrams,
          vitamins: scanResult.vitamins,
          photoUrl: selectedImageUri || undefined,
          source: "ai_camera",
        } as any,
      });
      qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
      setShowScanModal(false);
      setSelectedImageUri(null);
      setScanResult(null);
      Alert.alert("Meal Logged! 🎉", `"${scanResult.name}" (${scanResult.calories} kcal) added to ${scanResult.mealType}.`);
    } catch {
      await queueOfflineLog("meal", "/api/meals", scannedMeal);
      setShowScanModal(false);
      setSelectedImageUri(null);
      setScanResult(null);
      Alert.alert("Saved Locally", `"${scanResult.name}" saved to offline health database.`);
    }
  };

  // Customize scanned result in manual form
  const handleCustomizeScannedMeal = () => {
    if (!scanResult) return;
    setFoodName(scanResult.name);
    setMealType((scanResult.mealType as any) || "lunch");
    setCalories(String(scanResult.calories));
    setProtein(String(scanResult.proteinGrams));
    setCarbs(String(scanResult.carbsGrams));
    setFat(String(scanResult.fatGrams));
    setVitamins(scanResult.vitamins);
    setShowScanModal(false);
    setShowLogForm(true);
  };

  // Manual meal save
  const handleLogMeal = async () => {
    const nameToSave = foodName.trim() || `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Meal`;
    setIsSaving(true);

    const newMeal: MealRecord = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: nameToSave,
      mealType: mealType,
      calories: parseInt(calories, 10) || 0,
      proteinGrams: parseInt(protein, 10) || 0,
      carbsGrams: parseInt(carbs, 10) || 0,
      fatGrams: parseInt(fat, 10) || 0,
      vitamins: vitamins.trim() || undefined,
      items: [],
      source: "manual",
      loggedAt: new Date().toISOString(),
    };

    await saveMeal(newMeal);
    const updatedLocal = [newMeal, ...localMeals];
    setLocalMeals(updatedLocal);
    try {
      await storage.setItem("lumen_local_meals", JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn("Storage save error:", e);
    }

    qc.setQueryData(getListMealsQueryKey(), (old: any) => [newMeal, ...(Array.isArray(old) ? old : [])]);
    qc.setQueryData(getGetTodayDashboardQueryKey(), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        todayTotals: {
          ...old.todayTotals,
          caloriesIn: (old.todayTotals?.caloriesIn || 0) + newMeal.calories,
          proteinGrams: (old.todayTotals?.proteinGrams || 0) + newMeal.proteinGrams,
          carbsGrams: (old.todayTotals?.carbsGrams || 0) + newMeal.carbsGrams,
          fatGrams: (old.todayTotals?.fatGrams || 0) + newMeal.fatGrams,
        },
      };
    });

    try {
      await createMealMutation.mutateAsync({
        data: {
          name: newMeal.name,
          mealType: newMeal.mealType,
          calories: newMeal.calories,
          proteinGrams: newMeal.proteinGrams,
          carbsGrams: newMeal.carbsGrams,
          fatGrams: newMeal.fatGrams,
          vitamins: newMeal.vitamins,
          items: [],
          source: "manual",
        } as any,
      });
      qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
    } catch (err) {
      console.warn("Saved locally in SQLite:", err);
      await queueOfflineLog("meal", "/api/meals", newMeal);
    } finally {
      setIsSaving(false);
      setFoodName("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setVitamins("");
      setShowLogForm(false);
      Alert.alert("Meal Logged! 🎉", `"${newMeal.name}" (${newMeal.calories} kcal) saved to ${newMeal.mealType}.`);
    }
  };

  const handleDeleteMeal = async (id: string, name: string) => {
    Alert.alert(
      "Remove Meal",
      `Are you sure you want to remove "${name}" from today's log?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteMeal(id);
            const remainingLocal = localMeals.filter((m) => String(m.id) !== String(id));
            setLocalMeals(remainingLocal);
            try {
              await storage.setItem("lumen_local_meals", JSON.stringify(remainingLocal));
            } catch {}

            qc.setQueryData(getListMealsQueryKey(), (old: any) =>
              Array.isArray(old) ? old.filter((m: any) => String(m.id) !== String(id)) : []
            );

            if (!String(id).startsWith("local-") && !String(id).startsWith("meal-")) {
              try {
                await deleteMealMutation.mutateAsync({ mealId: id });
                qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
                qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
              } catch (err) {
                console.warn("Delete server error:", err);
              }
            }
          },
        },
      ]
    );
  };

  // Merge server meals with local meals for total continuity
  const serverMeals = Array.isArray(meals) ? meals : [];
  const allMeals: Array<any> = [...serverMeals];
  for (const lm of localMeals) {
    if (
      !allMeals.some(
        (m) =>
          String(m.id) === String(lm.id) ||
          (m.name === lm.name && (m.mealType || (m as any).meal_type) === (lm.mealType || (lm as any).meal_type))
      )
    ) {
      allMeals.push(lm);
    }
  }

  const totalCalories = allMeals.reduce((acc: number, m: any) => acc + (m.calories || 0), 0);
  const totalProtein = allMeals.reduce((acc: number, m: any) => acc + (m.proteinGrams ?? m.protein_grams ?? 0), 0);
  const totalCarbs = allMeals.reduce((acc: number, m: any) => acc + (m.carbsGrams ?? m.carbs_grams ?? 0), 0);
  const totalFat = allMeals.reduce((acc: number, m: any) => acc + (m.fatGrams ?? m.fat_grams ?? 0), 0);

  // Concentric Hero Gauge calculations
  const DIAL_SIZE = 220;
  const STROKE_CAL = 12;
  const STROKE_PRO = 9;

  const RADIUS_CAL = (DIAL_SIZE - STROKE_CAL - 4) / 2; // ~99
  const CIRCUMFERENCE_CAL = 2 * Math.PI * RADIUS_CAL;
  const calPercent = Math.min(100, Math.max(0, Math.round((totalCalories / calorieTarget) * 100)));
  const offsetCal = CIRCUMFERENCE_CAL - (calPercent / 100) * CIRCUMFERENCE_CAL;

  const RADIUS_PRO = (DIAL_SIZE - 48) / 2; // ~86
  const CIRCUMFERENCE_PRO = 2 * Math.PI * RADIUS_PRO;
  const proPercent = Math.min(100, Math.max(0, Math.round((totalProtein / proteinTarget) * 100)));
  const offsetPro = CIRCUMFERENCE_PRO - (proPercent / 100) * CIRCUMFERENCE_PRO;

  const calRemaining = Math.max(0, calorieTarget - totalCalories);
  const mealTypes: Array<"breakfast" | "lunch" | "dinner" | "snack"> = [
    "breakfast",
    "lunch",
    "dinner",
    "snack",
  ];

  const getMealIcon = (type: string) => {
    switch (type) {
      case "breakfast":
        return <Sunrise size={16} color="#10b981" />;
      case "lunch":
        return <Sun size={16} color="#38bdf8" />;
      case "dinner":
        return <Sunset size={16} color="#f59e0b" />;
      case "snack":
        return <Moon size={16} color="#a855f7" />;
      default:
        return <Apple size={16} color="#10b981" />;
    }
  };

  return (
    <View style={styles.container}>
      <AmbientAtmosphere variant="dashboard" />

      {/* TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={openLeftMenu} style={styles.menuBtn} accessibilityLabel="Open Menu">
            <Menu size={22} color="#f8fafc" />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0, marginHorizontal: 12 }}>
            <Text style={styles.headerSub} numberOfLines={1}>
              METABOLIC & NUTRITION ENGINE
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Nutrients & Macros
            </Text>
          </View>

          <Pressable style={styles.targetBadgeBtn} onPress={handleOpenTargetsModal}>
            <Target size={14} color="#10b981" />
            <Text style={styles.targetBadgeText} numberOfLines={1}>
              {calorieTarget} kcal
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================================= */}
        {/* HERO BIO-METER: CONCENTRIC CALORIE & PROTEIN DIAL */}
        {/* ========================================================================= */}
        <View style={styles.heroGaugeCard}>
          <View style={styles.heroGaugeTopRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} color="#10b981" />
              <Text style={styles.heroGaugeTitle}>DAILY METABOLIC METERS</Text>
            </View>
            <Pressable style={styles.heroEditTargetBtn} onPress={handleOpenTargetsModal}>
              <Sliders size={12} color="#94a3b8" />
              <Text style={styles.heroEditTargetBtnText}>Adjust Goals</Text>
            </Pressable>
          </View>

          {/* Concentric Gauge SVG Hub */}
          <View style={styles.gaugeCenterContainer}>
            <View style={{ width: DIAL_SIZE, height: DIAL_SIZE, alignItems: "center", justifyContent: "center" }}>
              <Svg width={DIAL_SIZE} height={DIAL_SIZE} style={StyleSheet.absoluteFill}>
                <Defs>
                  <LinearGradient id="calGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#10b981" />
                    <Stop offset="100%" stopColor="#059669" />
                  </LinearGradient>
                  <LinearGradient id="proGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#38bdf8" />
                    <Stop offset="100%" stopColor="#0284c7" />
                  </LinearGradient>
                </Defs>

                {/* Outer Ring: Calorie Background Track */}
                <Circle
                  cx={DIAL_SIZE / 2}
                  cy={DIAL_SIZE / 2}
                  r={RADIUS_CAL}
                  stroke="rgba(16, 185, 129, 0.12)"
                  strokeWidth={STROKE_CAL}
                  fill="transparent"
                />
                {/* Outer Ring: Calorie Progress */}
                <Circle
                  cx={DIAL_SIZE / 2}
                  cy={DIAL_SIZE / 2}
                  r={RADIUS_CAL}
                  stroke="url(#calGradient)"
                  strokeWidth={STROKE_CAL}
                  strokeDasharray={CIRCUMFERENCE_CAL}
                  strokeDashoffset={offsetCal}
                  strokeLinecap="round"
                  fill="transparent"
                  transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
                />

                {/* Inner Ring: Protein Background Track */}
                <Circle
                  cx={DIAL_SIZE / 2}
                  cy={DIAL_SIZE / 2}
                  r={RADIUS_PRO}
                  stroke="rgba(56, 189, 248, 0.12)"
                  strokeWidth={STROKE_PRO}
                  fill="transparent"
                />
                {/* Inner Ring: Protein Progress */}
                <Circle
                  cx={DIAL_SIZE / 2}
                  cy={DIAL_SIZE / 2}
                  r={RADIUS_PRO}
                  stroke="url(#proGradient)"
                  strokeWidth={STROKE_PRO}
                  strokeDasharray={CIRCUMFERENCE_PRO}
                  strokeDashoffset={offsetPro}
                  strokeLinecap="round"
                  fill="transparent"
                  transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
                />
              </Svg>

              {/* Inside Gauge Readout */}
              <View style={styles.gaugeInnerCore}>
                <View style={styles.gaugeFlamePill}>
                  <Flame size={14} color="#10b981" />
                  <Text style={styles.gaugeFlamePillText}>{calPercent}%</Text>
                </View>

                <Text style={styles.gaugeCaloriesNum} numberOfLines={1}>
                  {totalCalories}
                </Text>
                <Text style={styles.gaugeCaloriesLabel}>KCAL CONSUMED</Text>

                <View style={styles.gaugeProteinMiniPill}>
                  <Text style={styles.gaugeProteinMiniPillText} numberOfLines={1}>
                    🥩 {totalProtein}g / {proteinTarget}g Protein
                  </Text>
                </View>

                <Text style={styles.gaugeRemainingSub}>
                  {calRemaining > 0 ? `${calRemaining} kcal remaining` : "Target Achieved 🔥"}
                </Text>
              </View>
            </View>
          </View>

          {/* Macro Status Pods underneath Dial */}
          <View style={styles.macroPodsRow}>
            {/* Protein Pod */}
            <View style={[styles.macroPod, { borderColor: "rgba(56, 189, 248, 0.25)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Dumbbell size={13} color="#38bdf8" />
                  <Text style={styles.macroPodLabel}>PROTEIN</Text>
                </View>
                <Text style={[styles.macroPodPercent, { color: "#38bdf8" }]}>{proPercent}%</Text>
              </View>
              <Text style={styles.macroPodVal}>{totalProtein}g</Text>
              <View style={styles.macroPodTrack}>
                <View style={[styles.macroPodFill, { width: `${proPercent}%`, backgroundColor: "#38bdf8" }]} />
              </View>
              <Text style={styles.macroPodSub}>Target: {proteinTarget}g</Text>
            </View>

            {/* Carbs Pod */}
            <View style={[styles.macroPod, { borderColor: "rgba(168, 85, 247, 0.25)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Apple size={13} color="#a855f7" />
                  <Text style={styles.macroPodLabel}>CARBS</Text>
                </View>
              </View>
              <Text style={styles.macroPodVal}>{totalCarbs}g</Text>
              <View style={styles.macroPodTrack}>
                <View
                  style={[
                    styles.macroPodFill,
                    {
                      width: `${Math.min(100, Math.round((totalCarbs / 250) * 100))}%`,
                      backgroundColor: "#a855f7",
                    },
                  ]}
                />
              </View>
              <Text style={styles.macroPodSub}>Energy fuel</Text>
            </View>

            {/* Fats Pod */}
            <View style={[styles.macroPod, { borderColor: "rgba(245, 158, 11, 0.25)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Droplet size={13} color="#f59e0b" />
                  <Text style={styles.macroPodLabel}>FATS</Text>
                </View>
              </View>
              <Text style={styles.macroPodVal}>{totalFat}g</Text>
              <View style={styles.macroPodTrack}>
                <View
                  style={[
                    styles.macroPodFill,
                    {
                      width: `${Math.min(100, Math.round((totalFat / 70) * 100))}%`,
                      backgroundColor: "#f59e0b",
                    },
                  ]}
                />
              </View>
              <Text style={styles.macroPodSub}>Healthy lipids</Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* 1-TAP ACTION COMMAND ROW */}
        {/* ========================================================================= */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.scanActionBtn}
            onPress={() => setShowScanModal(!showScanModal)}
          >
            <Camera size={18} color="#050b08" strokeWidth={2.5} />
            <Text style={styles.scanActionBtnText} numberOfLines={1}>
              Scan Food Photo
            </Text>
          </Pressable>

          <Pressable
            style={styles.manualActionBtn}
            onPress={() => {
              setShowLogForm(true);
              setShowScanModal(false);
            }}
          >
            <Plus size={18} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.manualActionBtnText} numberOfLines={1}>
              Log Manually
            </Text>
          </Pressable>
        </View>

        {/* Hidden File Inputs for Web / Capacitor WebView */}
        {Platform.OS === "web" && (
          <>
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleWebFileChange}
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleWebFileChange}
            />
          </>
        )}

        {/* ========================================================================= */}
        {/* AI BIOMETRIC FOOD SCANNER HUD */}
        {/* ========================================================================= */}
        {showScanModal && (
          <View style={styles.scannerHudCard}>
            <View style={styles.scannerHudHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Scan size={18} color="#10b981" />
                <Text style={styles.scannerHudTitle}>AI NEURAL FOOD SCANNER</Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowScanModal(false);
                  setSelectedImageUri(null);
                  setScanResult(null);
                }}
                hitSlop={10}
              >
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={styles.scannerHudDesc}>
              Snap a picture with your camera or select from your gallery. Lumen's AI Vision detects food components, portion volume, calories, and micronutrients.
            </Text>

            {/* Trigger Buttons */}
            <View style={styles.scannerBtnRow}>
              <Pressable
                style={[styles.scannerCaptureBtn, { backgroundColor: "#10b981" }]}
                onPress={handleTakePhoto}
                disabled={isScanning}
              >
                <Camera size={18} color="#050b08" />
                <Text style={[styles.scannerCaptureBtnText, { color: "#050b08" }]}>Snap Food Photo</Text>
              </Pressable>

              <Pressable
                style={[styles.scannerCaptureBtn, styles.scannerGalleryBtn]}
                onPress={handlePickFromGallery}
                disabled={isScanning}
              >
                <ImageIcon size={18} color="#10b981" />
                <Text style={[styles.scannerCaptureBtnText, { color: "#10b981" }]}>Choose Gallery</Text>
              </Pressable>
            </View>

            {/* Photo Preview & Scanning Beam */}
            {selectedImageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: selectedImageUri }} style={styles.previewImage} resizeMode="cover" />
                {isScanning && (
                  <View style={styles.scanningOverlay}>
                    <ActivityIndicator size="large" color="#10b981" />
                    <Text style={styles.scanningText}>Analyzing food composition & micro-density...</Text>
                    <Text style={styles.scanningSubText}>Computing calories, protein & micronutrients</Text>
                  </View>
                )}
              </View>
            )}

            {/* AI Recognition Prediction Result Card */}
            {scanResult && !isScanning && (
              <View style={styles.resultCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.resultDishName}>{scanResult.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <View style={styles.confidenceBadge}>
                        <Sparkles size={11} color="#10b981" />
                        <Text style={styles.confidenceText}>
                          {Math.round((scanResult.confidence || 0.94) * 100)}% AI Match
                        </Text>
                      </View>
                      <View style={styles.mealTypeBadge}>
                        <Text style={styles.mealTypeBadgeText}>{scanResult.mealType.toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Macro Pills Grid */}
                <View style={styles.resultMacroGrid}>
                  <View style={styles.resultMacroBox}>
                    <Text style={styles.resultMacroVal}>{scanResult.calories}</Text>
                    <Text style={styles.resultMacroLabel}>Calories (kcal)</Text>
                  </View>
                  <View style={styles.resultMacroBox}>
                    <Text style={[styles.resultMacroVal, { color: "#38bdf8" }]}>{scanResult.proteinGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Protein</Text>
                  </View>
                  <View style={styles.resultMacroBox}>
                    <Text style={[styles.resultMacroVal, { color: "#a855f7" }]}>{scanResult.carbsGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Carbs</Text>
                  </View>
                  <View style={styles.resultMacroBox}>
                    <Text style={[styles.resultMacroVal, { color: "#f59e0b" }]}>{scanResult.fatGrams}g</Text>
                    <Text style={styles.resultMacroLabel}>Fat</Text>
                  </View>
                </View>

                {/* Micronutrients Box */}
                {scanResult.vitamins ? (
                  <View style={styles.vitaminsBox}>
                    <Text style={styles.vitaminsTitle}>🌿 Micronutrients & Vitamins:</Text>
                    <Text style={styles.vitaminsContent}>{scanResult.vitamins}</Text>
                  </View>
                ) : null}

                {/* Detected Ingredients Breakdown */}
                {scanResult.items && scanResult.items.length > 0 && (
                  <View style={styles.itemsBox}>
                    <Text style={styles.itemsTitle}>Detected Ingredients & Portions:</Text>
                    {scanResult.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          • {item.name} ({item.portion || item.quantity || "1 serving"})
                        </Text>
                        <Text style={styles.itemCal}>{item.calories} kcal</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* AI Health Observation */}
                {scanResult.notes ? (
                  <Text style={styles.resultNotes}>💡 {scanResult.notes}</Text>
                ) : null}

                {/* One-Tap Commit & Customize Buttons */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable style={styles.commitBtn} onPress={handleCommitScannedMeal}>
                    <Check size={16} color="#050b08" strokeWidth={2.5} />
                    <Text style={styles.commitBtnText}>1-Tap Log Meal</Text>
                  </Pressable>

                  <Pressable style={styles.customizeBtn} onPress={handleCustomizeScannedMeal}>
                    <Sliders size={15} color="#f8fafc" />
                    <Text style={styles.customizeBtnText}>Customize</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* MANUAL LOGGING FORM */}
        {/* ========================================================================= */}
        {showLogForm && (
          <View style={styles.formCard}>
            <View style={styles.formCardHeader}>
              <Text style={styles.formTitle}>Record Meal Manually</Text>
              <Pressable onPress={() => setShowLogForm(false)} hitSlop={10}>
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.mealTypeToggle}>
              {mealTypes.map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeBtn, mealType === type && styles.typeBtnSelected]}
                  onPress={() => setMealType(type)}
                >
                  <Text style={[styles.typeBtnText, mealType === type && styles.typeBtnTextSelected]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.inputGroup, { width: "100%" }]}>
                <Text style={styles.inputLabel}>Food or Dish Name *</Text>
                <TextInput
                  style={styles.input}
                  value={foodName}
                  onChangeText={setFoodName}
                  placeholder="e.g. Scrambled Eggs or Protein Shake"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Calories (kcal) *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Healthy Fat (g)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={fat}
                  onChangeText={setFat}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={[styles.inputGroup, { width: "100%" }]}>
                <Text style={styles.inputLabel}>Micronutrients & Vitamins (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={vitamins}
                  onChangeText={setVitamins}
                  placeholder="e.g. Vitamin C, Calcium, Iron"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>

            <View style={styles.formActionRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowLogForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                onPress={handleLogMeal}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#050b08" />
                ) : (
                  <Text style={styles.saveBtnText}>Save to Today's Log</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TODAY'S CULINARY SCHEDULE / TIMELINE */}
        {/* ========================================================================= */}
        <View style={styles.scheduleHeaderRow}>
          <View>
            <Text style={styles.scheduleTitle}>Today's Nutrition Timeline</Text>
            <Text style={styles.scheduleSub}>
              {allMeals.length > 0
                ? `${allMeals.length} logged entries • ${totalCalories} kcal total`
                : "No meals logged yet today"}
            </Text>
          </View>
        </View>

        <View style={styles.scheduleContainer}>
          {mealTypes.map((type) => {
            const typeMeals = allMeals.filter((m: any) => (m.mealType || m.meal_type) === type);
            const subtotalCal = typeMeals.reduce((acc: number, m: any) => acc + (m.calories || 0), 0);

            return (
              <View key={type} style={styles.scheduleSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {getMealIcon(type)}
                    <Text style={styles.sectionHeaderText}>{type.toUpperCase()}</Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {subtotalCal > 0 ? (
                      <View style={styles.sectionSubtotalBadge}>
                        <Text style={styles.sectionSubtotalText}>{subtotalCal} kcal</Text>
                      </View>
                    ) : null}

                    <Pressable
                      style={styles.sectionAddBtn}
                      onPress={() => {
                        setMealType(type);
                        setShowLogForm(true);
                      }}
                      hitSlop={8}
                    >
                      <Plus size={14} color="#10b981" />
                    </Pressable>
                  </View>
                </View>

                {typeMeals.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {typeMeals.map((m: any, idx: number) => (
                      <View key={m.id || idx} style={styles.mealCard}>
                        <View style={styles.mealCardTop}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.mealCardTitle} numberOfLines={1}>
                              {m.name}
                            </Text>
                            <Text style={styles.mealCardMacros} numberOfLines={1}>
                              <Text style={{ color: "#10b981", fontWeight: "800" }}>{m.calories} kcal</Text>
                              {"  •  "}P: {m.proteinGrams ?? m.protein_grams ?? 0}g{"  •  "}
                              C: {m.carbsGrams ?? m.carbs_grams ?? 0}g{"  •  "}
                              F: {m.fatGrams ?? m.fat_grams ?? 0}g
                            </Text>
                            {m.vitamins ? (
                              <Text style={styles.mealCardVitamins} numberOfLines={1}>
                                🌿 {m.vitamins}
                              </Text>
                            ) : null}
                          </View>

                          <Pressable
                            style={styles.mealDeleteBtn}
                            onPress={() => handleDeleteMeal(m.id, m.name)}
                            hitSlop={8}
                          >
                            <Trash2 size={15} color="#ef4444" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Pressable
                    style={styles.emptyMealSlot}
                    onPress={() => {
                      setMealType(type);
                      setShowLogForm(true);
                    }}
                  >
                    <Plus size={14} color="#10b981" />
                    <Text style={styles.emptyMealSlotText}>
                      No {type} logged yet • Tap to record
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* TARGET EDITING MODAL */}
      {/* ========================================================================= */}
      <Modal visible={showTargetModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Target size={18} color="#10b981" />
                <Text style={styles.modalTitle}>Daily Nutrient Targets</Text>
              </View>
              <Pressable onPress={() => setShowTargetModal(false)} hitSlop={10}>
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14, paddingVertical: 12 }}>
              <View>
                <Text style={styles.inputLabel}>Daily Calorie Target (kcal)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={tempCalTarget}
                  onChangeText={setTempCalTarget}
                  placeholder="2000"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Daily Protein Target (grams)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={tempProTarget}
                  onChangeText={setTempProTarget}
                  placeholder="130"
                  placeholderTextColor="#64748b"
                />
              </View>

              <Text style={{ fontSize: 11, color: "#94a3b8", fontWeight: "700", marginTop: 4 }}>
                QUICK TARGET PROFILES:
              </Text>

              <View style={{ gap: 8 }}>
                {[
                  { label: "Standard Wellness", cal: "2000", pro: "130" },
                  { label: "Athletic & Muscle Building", cal: "2200", pro: "150" },
                  { label: "Metabolic Lean Cut", cal: "1800", pro: "110" },
                ].map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.quickProfileBtn}
                    onPress={() => {
                      setTempCalTarget(item.cal);
                      setTempProTarget(item.pro);
                    }}
                  >
                    <Text style={styles.quickProfileLabel}>{item.label}</Text>
                    <Text style={styles.quickProfileVal}>
                      {item.cal} kcal • {item.pro}g Protein
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={styles.saveTargetsBtn} onPress={handleSaveTargets}>
                <Check size={16} color="#050b08" strokeWidth={3} />
                <Text style={styles.saveTargetsBtnText}>Update Daily Targets</Text>
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
    backgroundColor: THEME.colors.bgSolid,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 38,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    backgroundColor: THEME.colors.bgSolid,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSub: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  targetBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  targetBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10b981",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 16,
  },

  // HERO BIO-METER CARD
  heroGaugeCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 18,
    gap: 16,
    ...THEME.shadows.card,
  },
  heroGaugeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroGaugeTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.8,
  },
  heroEditTargetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  heroEditTargetBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
  },
  gaugeCenterContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  gaugeInnerCore: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 150,
  },
  gaugeFlamePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  gaugeFlamePillText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#10b981",
  },
  gaugeCaloriesNum: {
    fontSize: 32,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
    letterSpacing: -0.5,
  },
  gaugeCaloriesLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 1,
  },
  gaugeProteinMiniPill: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  gaugeProteinMiniPillText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#38bdf8",
  },
  gaugeRemainingSub: {
    fontSize: 9.5,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    marginTop: 4,
  },

  // Macro Status Pods
  macroPodsRow: {
    flexDirection: "row",
    gap: 10,
  },
  macroPod: {
    flex: 1,
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 4,
  },
  macroPodLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.5,
  },
  macroPodPercent: {
    fontSize: 9,
    fontWeight: "900",
  },
  macroPodVal: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
    marginVertical: 2,
  },
  macroPodTrack: {
    height: 4,
    backgroundColor: "rgba(200, 218, 210, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  macroPodFill: {
    height: "100%",
    borderRadius: 2,
  },
  macroPodSub: {
    fontSize: 9,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },

  // 1-Tap Action Row
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  scanActionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: "#10b981",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...THEME.shadows.card,
  },
  scanActionBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#050b08",
    letterSpacing: 0.2,
  },
  manualActionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.3)",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  manualActionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },

  // AI Food Scanner HUD
  scannerHudCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.4)",
    padding: 18,
    gap: 12,
    ...THEME.shadows.card,
  },
  scannerHudHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scannerHudTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 0.8,
  },
  scannerHudDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 16,
  },
  scannerBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  scannerCaptureBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scannerGalleryBtn: {
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  scannerCaptureBtnText: {
    fontSize: 12,
    fontWeight: "900",
  },
  imagePreviewContainer: {
    marginTop: 8,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.3)",
  },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
  },
  scanningOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 22, 19, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  scanningText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 13,
    textAlign: "center",
  },
  scanningSubText: {
    color: "#10b981",
    fontSize: 11,
    textAlign: "center",
  },

  // Scan Result Card
  resultCard: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    marginTop: 6,
  },
  resultDishName: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  confidenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#10b981",
  },
  mealTypeBadge: {
    backgroundColor: "rgba(232, 241, 237, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mealTypeBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: THEME.colors.cardTextSecondary,
  },
  resultMacroGrid: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  resultMacroBox: {
    flex: 1,
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
  },
  resultMacroVal: {
    fontSize: 13,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  resultMacroLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  vitaminsBox: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    padding: 10,
    borderRadius: 12,
  },
  vitaminsTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10b981",
  },
  vitaminsContent: {
    fontSize: 11,
    color: THEME.colors.cardTextPrimary,
    marginTop: 2,
  },
  itemsBox: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
    padding: 10,
    borderRadius: 12,
    gap: 4,
  },
  itemsTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontSize: 11,
    color: THEME.colors.cardTextPrimary,
    flex: 1,
  },
  itemCal: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "700",
  },
  resultNotes: {
    fontSize: 10.5,
    color: THEME.colors.cardTextSecondary,
    fontStyle: "italic",
    lineHeight: 15,
  },
  commitBtn: {
    flex: 1,
    height: 42,
    backgroundColor: "#10b981",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  commitBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#050b08",
  },
  customizeBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.3)",
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  customizeBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },

  // Manual Log Form Card
  formCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 18,
    gap: 12,
    ...THEME.shadows.card,
  },
  formCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  mealTypeToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBtnSelected: {
    backgroundColor: "#10b981",
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    textTransform: "capitalize",
  },
  typeBtnTextSelected: {
    color: "#050b08",
    fontWeight: "900",
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  inputGroup: {
    width: "48%",
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
  },
  input: {
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12,
    color: THEME.colors.cardTextPrimary,
  },
  formActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
  },
  saveBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#050b08",
  },

  // Today's Timeline
  scheduleHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  scheduleSub: {
    fontSize: 11,
    color: THEME.colors.textOnDarkSecondary,
    marginTop: 2,
  },
  scheduleContainer: {
    gap: 12,
  },
  scheduleSection: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 14,
    gap: 10,
    ...THEME.shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
    letterSpacing: 0.5,
  },
  sectionSubtotalBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionSubtotalText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#10b981",
  },
  sectionAddBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  mealCard: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
    borderRadius: 14,
    padding: 12,
  },
  mealCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  mealCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  mealCardMacros: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 3,
    fontWeight: "600",
  },
  mealCardVitamins: {
    fontSize: 10,
    color: "#10b981",
    marginTop: 3,
    fontStyle: "italic",
  },
  mealDeleteBtn: {
    padding: 4,
  },
  emptyMealSlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(200, 218, 210, 0.25)",
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(232, 241, 237, 0.04)",
  },
  emptyMealSlotText: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "700",
  },

  // Target Editor Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: THEME.colors.drawerBg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.3)",
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  quickProfileBtn: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    padding: 10,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickProfileLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  quickProfileVal: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10b981",
  },
  saveTargetsBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  saveTargetsBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#050b08",
  },
});
