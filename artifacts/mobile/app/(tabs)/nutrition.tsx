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
  TouchableOpacity,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
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
  AlertCircle,
  Calendar,
} from "lucide-react-native";
import { queueOfflineLog, getMeals, saveMeal, deleteMeal, MealRecord, formatDateKey } from "@/services/db";
import { storage } from "@/services/storage";
import { dailyRolloverService } from "@/services/dailyRolloverService";
import { useSlideMenu } from "@/context/SlideMenuContext";
import THEME from "@/constants/theme";
import { AmbientAtmosphere } from "@/components/AmbientAtmosphere";
import {
  analyzeFoodImageWithGemini,
  estimateNutritionFromFoodDescription,
  getGeminiApiKey,
  isValidGeminiApiKey,
} from "@/services/geminiAi";

const triggerHaptic = (style: "light" | "medium" | "heavy" | "success" = "light") => {
  if (Platform.OS === "web") return;
  try {
    if (style === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (style === "heavy") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (style === "medium") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {}
};

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

  // Date Navigation & Midnight Rollover State
  const initialTodayKey = formatDateKey(new Date());
  const [activeTodayKey, setActiveTodayKey] = useState<string>(initialTodayKey);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(initialTodayKey);
  const [viewMode, setViewMode] = useState<"today" | "history">("today");

  // Subscribe to daily rollover
  useEffect(() => {
    const unsub = dailyRolloverService.subscribe((newKey) => {
      setActiveTodayKey(newKey);
      setSelectedDateKey(newKey);
      setViewMode("today");
    });
    return unsub;
  }, []);

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
  const [scanError, setScanError] = useState<string | null>(null);

  // AI Food Text Estimator States
  const [showAiTextModal, setShowAiTextModal] = useState<boolean>(false);
  const [aiFoodQuery, setAiFoodQuery] = useState<string>("");
  const [isEstimatingAi, setIsEstimatingAi] = useState<boolean>(false);
  const [aiEstimateResult, setAiEstimateResult] = useState<{
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
  const [aiEstimateError, setAiEstimateError] = useState<string | null>(null);
  const [isAutoFillingManual, setIsAutoFillingManual] = useState<boolean>(false);

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
    setScanError(null);

    const payload = base64 || uri;

    try {
      // 1. Direct on-device Google Gemini Vision
      const geminiKey = await getGeminiApiKey();
      if (!geminiKey || !isValidGeminiApiKey(geminiKey)) {
        throw new Error("No Google Gemini API key configured. Please enter your key in Coach settings.");
      }

      const directResult = await analyzeFoodImageWithGemini(payload, "healthy meal analysis");
      if (directResult && directResult.name) {
        setScanResult(directResult);
        setScanError(null);
        return;
      }
      throw new Error("Gemini Vision could not identify clear food items in this photo.");
    } catch (err: any) {
      console.warn("Food scan recognition error:", err);
      const errMsg = err?.message || "Failed to analyze food photo. Please check your lighting or internet connection.";
      setScanError(errMsg);
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
    setTimeout(() => {
      try {
        if (e.target) e.target.value = "";
      } catch {}
    }, 500);
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

  // --------------------------------------------------------------------------
  // AI FOOD TEXT ESTIMATOR HANDLERS
  // --------------------------------------------------------------------------
  const handleEstimateFoodNutrition = async (queryParam?: string) => {
    const textToAnalyze = (queryParam || aiFoodQuery).trim();
    if (!textToAnalyze) {
      Alert.alert("Food Name Required", "Please enter a food or meal name to estimate (e.g. '2 boiled eggs & toast').");
      return;
    }
    triggerHaptic("medium");
    setIsEstimatingAi(true);
    setAiEstimateError(null);
    setAiEstimateResult(null);

    try {
      const result = await estimateNutritionFromFoodDescription(textToAnalyze);
      setAiEstimateResult(result);
      setAiEstimateError(null);
      triggerHaptic("success");
    } catch (err: any) {
      console.warn("AI Food estimation error:", err);
      setAiEstimateError(err?.message || "Failed to estimate nutrition for this food.");
    } finally {
      setIsEstimatingAi(false);
    }
  };

  const handleCommitAiEstimatedMeal = async () => {
    if (!aiEstimateResult) return;
    triggerHaptic("success");

    const mealToSave: MealRecord = {
      id: `meal-ai-${Date.now()}`,
      name: aiEstimateResult.name,
      mealType: (aiEstimateResult.mealType as any) || "lunch",
      calories: aiEstimateResult.calories,
      proteinGrams: aiEstimateResult.proteinGrams,
      carbsGrams: aiEstimateResult.carbsGrams,
      fatGrams: aiEstimateResult.fatGrams,
      vitamins: aiEstimateResult.vitamins,
      items: aiEstimateResult.items || [],
      source: "ai_text" as any,
      loggedAt: new Date().toISOString(),
    };

    await saveMeal(mealToSave);
    const updated = [mealToSave, ...localMeals];
    setLocalMeals(updated);
    await storage.setItem("lumen_local_meals", JSON.stringify(updated));

    qc.setQueryData(getListMealsQueryKey(), (old: any) => [mealToSave, ...(Array.isArray(old) ? old : [])]);
    qc.setQueryData(getGetTodayDashboardQueryKey(), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        todayTotals: {
          ...old.todayTotals,
          caloriesIn: (old.todayTotals?.caloriesIn || 0) + mealToSave.calories,
          proteinGrams: (old.todayTotals?.proteinGrams || 0) + mealToSave.proteinGrams,
          carbsGrams: (old.todayTotals?.carbsGrams || 0) + mealToSave.carbsGrams,
          fatGrams: (old.todayTotals?.fatGrams || 0) + mealToSave.fatGrams,
        },
      };
    });

    try {
      await createMealMutation.mutateAsync({
        data: {
          name: mealToSave.name,
          mealType: mealToSave.mealType,
          calories: mealToSave.calories,
          proteinGrams: mealToSave.proteinGrams,
          carbsGrams: mealToSave.carbsGrams,
          fatGrams: mealToSave.fatGrams,
          vitamins: mealToSave.vitamins,
          items: mealToSave.items,
          source: "ai_text",
        } as any,
      });
      qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
      setShowAiTextModal(false);
      setAiEstimateResult(null);
      setAiFoodQuery("");
      Alert.alert("Meal Logged! 🎉", `"${mealToSave.name}" (${mealToSave.calories} kcal) added to your nutrition.`);
    } catch {
      await queueOfflineLog("meal", "/api/meals", mealToSave);
      setShowAiTextModal(false);
      setAiEstimateResult(null);
      setAiFoodQuery("");
      Alert.alert("Saved Locally", `"${mealToSave.name}" saved to offline health database.`);
    }
  };

  const handleCustomizeAiEstimatedMeal = () => {
    if (!aiEstimateResult) return;
    triggerHaptic("light");
    setFoodName(aiEstimateResult.name);
    setMealType((aiEstimateResult.mealType as any) || "lunch");
    setCalories(String(aiEstimateResult.calories));
    setProtein(String(aiEstimateResult.proteinGrams));
    setCarbs(String(aiEstimateResult.carbsGrams));
    setFat(String(aiEstimateResult.fatGrams));
    setVitamins(aiEstimateResult.vitamins || "");
    setShowAiTextModal(false);
    setShowScanModal(false);
    setShowLogForm(true);
  };

  const handleAutoFillManualFromAi = async () => {
    const textToAnalyze = foodName.trim();
    if (!textToAnalyze) {
      Alert.alert("Name Required", "Please type a food name first (e.g. '2 boiled eggs and toast' or 'Grilled salmon bowl').");
      return;
    }
    triggerHaptic("medium");
    setIsAutoFillingManual(true);
    try {
      const res = await estimateNutritionFromFoodDescription(textToAnalyze);
      setCalories(String(res.calories));
      setProtein(String(res.proteinGrams));
      setCarbs(String(res.carbsGrams));
      setFat(String(res.fatGrams));
      if (res.vitamins) setVitamins(res.vitamins);
      if (res.mealType) setMealType(res.mealType as any);
      triggerHaptic("success");
    } catch (e: any) {
      Alert.alert("Auto-Fill Note", e?.message || "Could not estimate macros for this item.");
    } finally {
      setIsAutoFillingManual(false);
    }
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

  // Active target date key (Today resets cleanly to 0 at midnight; Past Days viewable in History)
  const activeDateKey = viewMode === "today" ? activeTodayKey : selectedDateKey;

  // Filter meals strictly for the currently viewed date
  const displayedMeals = allMeals.filter((m) => {
    const mealDate = (m.loggedAt || (m as any).logged_at || "").slice(0, 10);
    return mealDate === activeDateKey;
  });

  // Extract all unique past dates for historical inspection
  const availablePastDates = Array.from(
    new Set(
      allMeals
        .map((m) => (m.loggedAt || (m as any).logged_at || "").slice(0, 10))
        .filter((d) => d && d.length === 10 && d !== activeTodayKey)
    )
  ).sort((a, b) => b.localeCompare(a));

  const totalCalories = displayedMeals.reduce((acc: number, m: any) => acc + (m.calories || 0), 0);
  const totalProtein = displayedMeals.reduce((acc: number, m: any) => acc + (m.proteinGrams ?? m.protein_grams ?? 0), 0);
  const totalCarbs = displayedMeals.reduce((acc: number, m: any) => acc + (m.carbsGrams ?? m.carbs_grams ?? 0), 0);
  const totalFat = displayedMeals.reduce((acc: number, m: any) => acc + (m.fatGrams ?? m.fat_grams ?? 0), 0);

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
        {/* DATE SELECTION & MIDNIGHT ROLLOVER SWITCHER */}
        {/* ========================================================================= */}
        <View style={styles.dateSelectorContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic("light");
              setViewMode("today");
              setSelectedDateKey(activeTodayKey);
            }}
            style={[styles.dateTabPill, viewMode === "today" && styles.dateTabPillActive]}
          >
            <Sparkles size={13} color={viewMode === "today" ? "#10b981" : "#94a3b8"} />
            <Text style={[styles.dateTabPillText, viewMode === "today" && styles.dateTabPillTextActive]}>
              Today's Targets
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic("light");
              setViewMode("history");
              if (availablePastDates.length > 0 && !availablePastDates.includes(selectedDateKey)) {
                setSelectedDateKey(availablePastDates[0]);
              }
            }}
            style={[styles.dateTabPill, viewMode === "history" && styles.dateTabPillActive]}
          >
            <Clock size={13} color={viewMode === "history" ? "#38bdf8" : "#94a3b8"} />
            <Text style={[styles.dateTabPillText, viewMode === "history" && styles.dateTabPillTextActive]}>
              Past Days History ({availablePastDates.length})
            </Text>
          </TouchableOpacity>
        </View>

        {viewMode === "history" && (
          <View style={styles.pastDatesWrapper}>
            {availablePastDates.length === 0 ? (
              <View style={styles.noPastDatesBox}>
                <Text style={styles.noPastDatesText}>
                  No past day logs yet. As each day resets at 12 midnight, historical logs will automatically archive here!
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pastDatesScroll}>
                {availablePastDates.map((dateStr) => {
                  const isSelected = selectedDateKey === dateStr;
                  return (
                    <TouchableOpacity
                      key={dateStr}
                      activeOpacity={0.8}
                      onPress={() => {
                        triggerHaptic("light");
                        setSelectedDateKey(dateStr);
                      }}
                      style={[styles.pastDateChip, isSelected && styles.pastDateChipActive]}
                    >
                      <Calendar size={12} color={isSelected ? "#38bdf8" : "#64748b"} />
                      <Text style={[styles.pastDateChipText, isSelected && styles.pastDateChipTextActive]}>
                        {dateStr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.historyViewingBanner}>
              <Text style={styles.historyViewingText}>
                Viewing logs for <Text style={{ color: "#38bdf8", fontWeight: "bold" }}>{activeDateKey}</Text>
              </Text>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic("light");
                  setViewMode("today");
                  setSelectedDateKey(activeTodayKey);
                }}
                style={styles.returnTodayBtn}
              >
                <Text style={styles.returnTodayBtnText}>Back to Today ➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
        {/* 1-TAP ACTION COMMAND ROW (Scan Food Photo • AI Food Estimator • Log Manually) */}
        {/* ========================================================================= */}
        <View style={styles.actionRow}>
          {/* 1. Camera / Photo AI Scanner */}
          <Pressable
            style={styles.scanActionBtn}
            onPress={() => {
              triggerHaptic("medium");
              setShowScanModal(!showScanModal);
              setShowAiTextModal(false);
              setShowLogForm(false);
            }}
          >
            <Camera size={16} color="#050b08" strokeWidth={2.5} />
            <Text style={styles.scanActionBtnText} numberOfLines={1}>
              Scan Photo
            </Text>
          </Pressable>

          {/* 2. AI Food Text & Macro Estimator */}
          <Pressable
            style={styles.aiTextActionBtn}
            onPress={() => {
              triggerHaptic("medium");
              setShowAiTextModal(!showAiTextModal);
              setShowScanModal(false);
              setShowLogForm(false);
            }}
          >
            <Sparkles size={16} color="#0b1410" strokeWidth={2.5} />
            <Text style={styles.aiTextActionBtnText} numberOfLines={1}>
              AI Estimator
            </Text>
          </Pressable>

          {/* 3. Manual Log Entry */}
          <Pressable
            style={styles.manualActionBtn}
            onPress={() => {
              triggerHaptic("medium");
              setShowLogForm(!showLogForm);
              setShowScanModal(false);
              setShowAiTextModal(false);
            }}
          >
            <Plus size={16} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.manualActionBtnText} numberOfLines={1}>
              Log Manual
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

            {/* Action Bar / Error Banner when photo is selected but no result yet */}
            {selectedImageUri && !isScanning && !scanResult && (
              <View style={styles.pendingActionCard}>
                {scanError ? (
                  <View style={styles.scanErrorContainer}>
                    <AlertCircle size={16} color="#ef4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scanErrorTitle}>Analysis Notice</Text>
                      <Text style={styles.scanErrorDesc}>{scanError}</Text>
                    </View>
                  </View>
                ) : null}

                <Pressable
                  style={styles.runAnalysisBtn}
                  onPress={() => processImageForNutrition(selectedImageUri)}
                >
                  <Sparkles size={16} color="#050b08" />
                  <Text style={styles.runAnalysisBtnText}>
                    {scanError ? "Retry AI Nutrition Scan" : "Analyze Food with AI Vision"}
                  </Text>
                </Pressable>
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
        {/* AI FOOD TEXT & MACRONUTRIENT ESTIMATOR HUD */}
        {/* ========================================================================= */}
        {showAiTextModal && (
          <View style={styles.aiTextHudCard}>
            {/* Header */}
            <View style={styles.scannerHudHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Sparkles size={18} color="#d4f933" />
                <Text style={[styles.scannerHudTitle, { color: "#d4f933" }]}>AI FOOD & MACRO ESTIMATOR</Text>
              </View>
              <Pressable
                onPress={() => {
                  triggerHaptic("light");
                  setShowAiTextModal(false);
                  setAiEstimateResult(null);
                  setAiEstimateError(null);
                }}
                hitSlop={10}
              >
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={styles.scannerHudDesc}>
              Type any dish, ingredient, or meal. Lumen's AI calculates accurate calories, protein, carbs, fat, and micronutrients instantly.
            </Text>

            {/* Input & Estimate Button Row */}
            <View style={styles.aiTextInputRow}>
              <TextInput
                style={styles.aiTextSearchInput}
                placeholder="e.g. 2 boiled eggs and avocado toast..."
                placeholderTextColor="#5a7065"
                value={aiFoodQuery}
                onChangeText={setAiFoodQuery}
                onSubmitEditing={() => handleEstimateFoodNutrition()}
                returnKeyType="search"
              />
              <Pressable
                style={[styles.aiTextEstimateBtn, isEstimatingAi && { opacity: 0.7 }]}
                onPress={() => handleEstimateFoodNutrition()}
                disabled={isEstimatingAi}
              >
                {isEstimatingAi ? (
                  <ActivityIndicator size="small" color="#0b1410" />
                ) : (
                  <>
                    <Sparkles size={14} color="#0b1410" strokeWidth={2.5} />
                    <Text style={styles.aiTextEstimateBtnText}>Estimate</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Quick Suggestion Chips */}
            <View style={styles.aiChipsScroll}>
              {[
                "2 Boiled Eggs & Toast",
                "Grilled Chicken & Rice",
                "Salmon with Quinoa",
                "Oatmeal & Berries",
                "Protein Shake",
                "Paneer Salad",
              ].map((chip) => (
                <Pressable
                  key={chip}
                  style={styles.aiChipPill}
                  onPress={() => {
                    setAiFoodQuery(chip);
                    handleEstimateFoodNutrition(chip);
                  }}
                >
                  <Text style={styles.aiChipText}>{chip}</Text>
                </Pressable>
              ))}
            </View>

            {/* Error Message if any */}
            {aiEstimateError && (
              <View style={styles.scanErrorContainer}>
                <AlertCircle size={16} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.scanErrorTitle}>Estimation Note</Text>
                  <Text style={styles.scanErrorDesc}>{aiEstimateError}</Text>
                </View>
              </View>
            )}

            {/* AI Estimation Result Card */}
            {aiEstimateResult && !isEstimatingAi && (
              <View style={styles.aiResultCard}>
                <View style={styles.aiResultHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiResultFoodName}>{aiEstimateResult.name}</Text>
                    <Text style={styles.aiResultVitamins}>{aiEstimateResult.vitamins}</Text>
                  </View>
                  <View style={styles.aiResultMealTypeBadge}>
                    <Text style={styles.aiResultMealTypeText}>{aiEstimateResult.mealType}</Text>
                  </View>
                </View>

                {/* 4 Macro Pods in a clean row */}
                <View style={styles.aiResultMacrosGrid}>
                  <View style={[styles.aiMacroPod, { borderColor: "rgba(212, 249, 51, 0.4)" }]}>
                    <Text style={[styles.aiMacroPodVal, { color: "#d4f933" }]}>{aiEstimateResult.calories}</Text>
                    <Text style={styles.aiMacroPodLabel}>Calories</Text>
                  </View>

                  <View style={[styles.aiMacroPod, { borderColor: "rgba(16, 185, 129, 0.4)" }]}>
                    <Text style={[styles.aiMacroPodVal, { color: "#10b981" }]}>{aiEstimateResult.proteinGrams}g</Text>
                    <Text style={styles.aiMacroPodLabel}>Protein</Text>
                  </View>

                  <View style={[styles.aiMacroPod, { borderColor: "rgba(6, 182, 212, 0.4)" }]}>
                    <Text style={[styles.aiMacroPodVal, { color: "#06b6d4" }]}>{aiEstimateResult.carbsGrams}g</Text>
                    <Text style={styles.aiMacroPodLabel}>Carbs</Text>
                  </View>

                  <View style={[styles.aiMacroPod, { borderColor: "rgba(245, 158, 11, 0.4)" }]}>
                    <Text style={[styles.aiMacroPodVal, { color: "#f59e0b" }]}>{aiEstimateResult.fatGrams}g</Text>
                    <Text style={styles.aiMacroPodLabel}>Fat</Text>
                  </View>
                </View>

                {/* Clinical Notes */}
                {aiEstimateResult.notes && (
                  <Text style={styles.aiResultNotes}>💡 {aiEstimateResult.notes}</Text>
                )}

                {/* 1-Tap Log + Customize Buttons */}
                <View style={styles.aiResultActionsRow}>
                  <Pressable
                    style={styles.aiCommitLogBtn}
                    onPress={handleCommitAiEstimatedMeal}
                  >
                    <Check size={16} color="#050b08" strokeWidth={2.8} />
                    <Text style={styles.aiCommitLogBtnText}>1-Tap Log Meal</Text>
                  </Pressable>

                  <Pressable
                    style={styles.aiCustomizeBtn}
                    onPress={handleCustomizeAiEstimatedMeal}
                  >
                    <Sliders size={15} color="#e2e8f0" />
                    <Text style={styles.aiCustomizeBtnText}>Customize</Text>
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <Text style={styles.inputLabel}>Food or Dish Name *</Text>
                  <Pressable
                    style={styles.autoFillBtn}
                    onPress={handleAutoFillManualFromAi}
                    disabled={isAutoFillingManual}
                  >
                    {isAutoFillingManual ? (
                      <ActivityIndicator size="small" color="#d4f933" />
                    ) : (
                      <>
                        <Sparkles size={11} color="#d4f933" />
                        <Text style={styles.autoFillBtnText}>✨ AI Auto-Fill</Text>
                      </>
                    )}
                  </Pressable>
                </View>
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
            <Text style={styles.scheduleTitle}>
              {viewMode === "today" ? "Today's Nutrition Timeline" : `Nutrition Timeline • ${activeDateKey}`}
            </Text>
            <Text style={styles.scheduleSub}>
              {displayedMeals.length > 0
                ? `${displayedMeals.length} logged ${viewMode === "today" ? "entries" : "records"} • ${totalCalories} kcal total`
                : viewMode === "today"
                ? "No meals logged yet today • Clean slate for today!"
                : "No meals recorded for this date"}
            </Text>
          </View>
        </View>

        <View style={styles.scheduleContainer}>
          {mealTypes.map((type) => {
            const typeMeals = displayedMeals.filter((m: any) => (m.mealType || m.meal_type) === type);
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

  // 1-Tap Action Row (3 Action Buttons)
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  scanActionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: "#10b981",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...THEME.shadows.card,
  },
  scanActionBtnText: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#050b08",
    letterSpacing: 0.2,
  },
  aiTextActionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: "#d4f933",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...THEME.shadows.card,
  },
  aiTextActionBtnText: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#0b1410",
    letterSpacing: 0.2,
  },
  manualActionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.3)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  manualActionBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },

  // AI Food Text Estimator HUD
  aiTextHudCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(212, 249, 51, 0.4)",
    padding: 16,
    gap: 12,
    ...THEME.shadows.card,
  },
  aiTextInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  aiTextSearchInput: {
    flex: 1,
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(212, 249, 51, 0.35)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 12.5,
    color: THEME.colors.cardTextPrimary,
    ...Platform.select({
      web: { outlineStyle: "none" } as any,
    }),
  },
  aiTextEstimateBtn: {
    backgroundColor: "#d4f933",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  aiTextEstimateBtnText: {
    color: "#0b1410",
    fontSize: 12,
    fontWeight: "900",
  },
  aiChipsScroll: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  aiChipPill: {
    backgroundColor: "rgba(232, 241, 237, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  aiChipText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10.5,
    fontWeight: "700",
  },
  aiResultCard: {
    backgroundColor: "rgba(232, 241, 237, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(212, 249, 51, 0.3)",
    borderRadius: 18,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  aiResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  aiResultFoodName: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  aiResultVitamins: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "600",
    marginTop: 2,
  },
  aiResultMealTypeBadge: {
    backgroundColor: "rgba(212, 249, 51, 0.15)",
    borderWidth: 1,
    borderColor: "#d4f933",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  aiResultMealTypeText: {
    color: "#d4f933",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  aiResultMacrosGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  aiMacroPod: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  aiMacroPodVal: {
    fontSize: 14,
    fontWeight: "900",
  },
  aiMacroPodLabel: {
    fontSize: 9,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "700",
    marginTop: 2,
  },
  aiResultNotes: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 16,
    fontStyle: "italic",
    paddingHorizontal: 2,
  },
  aiResultActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  aiCommitLogBtn: {
    flex: 1,
    height: 42,
    backgroundColor: "#10b981",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  aiCommitLogBtnText: {
    color: "#050b08",
    fontSize: 12,
    fontWeight: "900",
  },
  aiCustomizeBtn: {
    paddingHorizontal: 16,
    height: 42,
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  aiCustomizeBtnText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  autoFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(212, 249, 51, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(212, 249, 51, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  autoFillBtnText: {
    color: "#d4f933",
    fontSize: 10,
    fontWeight: "800",
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
  pendingActionCard: {
    backgroundColor: "rgba(232, 241, 237, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginTop: 8,
  },
  scanErrorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    padding: 10,
  },
  scanErrorTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f87171",
  },
  scanErrorDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  runAnalysisBtn: {
    backgroundColor: "#10b981",
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  runAnalysisBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#050b08",
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

  // DATE SELECTOR & MIDNIGHT ROLLOVER HISTORY STYLES
  dateSelectorContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  dateTabPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  dateTabPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  dateTabPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  dateTabPillTextActive: {
    color: "#10b981",
  },
  pastDatesWrapper: {
    marginBottom: 16,
    gap: 10,
  },
  noPastDatesBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 14,
    padding: 12,
  },
  noPastDatesText: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 16,
  },
  pastDatesScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  pastDateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  pastDateChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  pastDateChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  pastDateChipTextActive: {
    color: "#38bdf8",
    fontWeight: "700",
  },
  historyViewingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyViewingText: {
    fontSize: 12,
    color: "#cbd5e1",
  },
  returnTodayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  returnTodayBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38bdf8",
  },
});
