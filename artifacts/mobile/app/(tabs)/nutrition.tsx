import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput } from "react-native";
import { useListMeals, useCreateMeal, useDeleteMeal, useRecognizeFood, getListMealsQueryKey, getGetTodayDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Utensils, Plus, Trash2, Camera, Sparkles, Check, 
  ChevronRight, Apple, Flame, Award 
} from "lucide-react-native";
import { queueOfflineLog } from "@/services/db";

export default function NutritionScreen() {
  const qc = useQueryClient();
  const [showLogForm, setShowLogForm] = useState(false);
  const [mealType, setMealType] = useState("breakfast");

  // Form states
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("350");
  const [protein, setProtein] = useState("20");
  const [carbs, setCarbs] = useState("40");
  const [fat, setFat] = useState("10");
  const [vitamins, setVitamins] = useState("Vitamin C: 12mg");

  const { data: meals } = useListMeals();
  const createMealMutation = useCreateMeal();
  const deleteMealMutation = useDeleteMeal();

  const handleLogMeal = async () => {
    if (!foodName.trim()) return;

    try {
      await createMealMutation.mutateAsync({
        data: {
          name: foodName,
          mealType: mealType,
          calories: parseInt(calories) || 0,
          proteinGrams: parseInt(protein) || 0,
          carbsGrams: parseInt(carbs) || 0,
          fatGrams: parseInt(fat) || 0,
          vitamins: vitamins
        }
      });
      qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
      setFoodName("");
      setShowLogForm(false);
    } catch {
      await queueOfflineLog("meal", "/api/meals", {
        name: foodName,
        mealType: mealType,
        calories: parseInt(calories) || 0,
        proteinGrams: parseInt(protein) || 0,
        carbsGrams: parseInt(carbs) || 0,
        fatGrams: parseInt(fat) || 0,
        vitamins: vitamins
      });
      alert("Device offline. Meal queued to local database.");
      setFoodName("");
      setShowLogForm(false);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      await deleteMealMutation.mutateAsync({ mealId: id });
      qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
    } catch {
      alert("Failed to delete meal");
    }
  };

  const totalCalories = meals?.reduce((acc: number, m: any) => acc + (m.calories || 0), 0) || 0;
  const totalProtein = meals?.reduce((acc: number, m: any) => acc + (m.proteinGrams || 0), 0) || 0;
  const totalCarbs = meals?.reduce((acc: number, m: any) => acc + (m.carbsGrams || 0), 0) || 0;
  const totalFat = meals?.reduce((acc: number, m: any) => acc + (m.fatGrams || 0), 0) || 0;

  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>Nutrition Tracker</Text>
        <Text style={styles.headerTitle}>Meals & Macros</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Macro Progress Ring Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Today's Totals</Text>
          <View style={styles.macroRow}>
            <View style={styles.macroCol}>
              <Text style={styles.macroVal}>{totalCalories}</Text>
              <Text style={styles.macroLabel}>Calories</Text>
            </View>
            <View style={styles.macroCol}>
              <Text style={[styles.macroVal, { color: "#10b981" }]}>{totalProtein}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroCol}>
              <Text style={[styles.macroVal, { color: "#3b82f6" }]}>{totalCarbs}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroCol}>
              <Text style={[styles.macroVal, { color: "#f59e0b" }]}>{totalFat}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Scan & Add triggers */}
        <View style={styles.actionRow}>
          <Pressable style={styles.scanBtn} onPress={() => alert("Launching AI camera scanner...")}>
            <Camera size={16} color="#050b08" style={{ marginRight: 6 }} />
            <Text style={styles.scanBtnText}>Scan Food Photo</Text>
          </Pressable>
          <Pressable style={styles.manualBtn} onPress={() => setShowLogForm(true)}>
            <Plus size={16} color="#e2e8f0" style={{ marginRight: 6 }} />
            <Text style={styles.manualBtnText}>Log Manually</Text>
          </Pressable>
        </View>

        {/* Quick Log Form */}
        {showLogForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Record Meal</Text>
            <View style={styles.mealTypeToggle}>
              {mealTypes.map(type => (
                <Pressable 
                  key={type} 
                  style={[styles.typeBtn, mealType === type && styles.typeBtnSelected]}
                  onPress={() => setMealType(type)}
                >
                  <Text style={[styles.typeBtnText, mealType === type && styles.typeBtnTextSelected]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.formGrid}>
              <View style={[styles.inputGroup, { width: "100%" }]}>
                <Text style={styles.label}>Food Name</Text>
                <TextInput style={styles.input} value={foodName} onChangeText={setFoodName} placeholder="e.g. Avocado Toast" placeholderTextColor="#475569" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Calories</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={calories} onChangeText={setCalories} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Protein (g)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={protein} onChangeText={setProtein} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Carbs (g)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={carbs} onChangeText={setCarbs} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Fat (g)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={fat} onChangeText={setFat} />
              </View>
              <View style={[styles.inputGroup, { width: "100%" }]}>
                <Text style={styles.label}>Vitamins & Minerals</Text>
                <TextInput style={styles.input} value={vitamins} onChangeText={setVitamins} placeholder="Vitamin C: 12mg" placeholderTextColor="#475569" />
              </View>
            </View>
            <View style={styles.formActionRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowLogForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleLogMeal}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Tabular Daily Schedule grouped by Breakfast, Lunch, Dinner, Snack */}
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Today's Schedule</Text>
        </View>

        <View style={styles.scheduleContainer}>
          {mealTypes.map(type => {
            const typeMeals = meals?.filter((m: any) => m.mealType === type) || [];
            return (
              <View key={type} style={styles.scheduleSection}>
                <Text style={styles.sectionHeader}>{type}</Text>
                {typeMeals.length > 0 ? (
                  typeMeals.map((m: any, idx: number) => (
                    <View key={idx} style={styles.mealRow}>
                      <View style={styles.mealLeft}>
                        <Apple size={16} color="#10b981" />
                        <View>
                          <Text style={styles.mealName}>{m.name}</Text>
                          <Text style={styles.mealMacros}>
                            {m.calories} kcal • P: {m.proteinGrams}g • C: {m.carbsGrams}g • F: {m.fatGrams}g
                          </Text>
                          {m.vitamins && <Text style={styles.mealVitamins}>{m.vitamins}</Text>}
                        </View>
                      </View>
                      <Pressable onPress={() => handleDeleteMeal(m.id)}>
                        <Trash2 size={16} color="#64748b" />
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Pressable 
                    style={styles.emptySessionRow}
                    onPress={() => {
                      setMealType(type);
                      setShowLogForm(true);
                    }}
                  >
                    <Plus size={12} color="#10b981" />
                    <Text style={styles.emptySessionText}>Add food to {type}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    paddingHorizontal: 25,
    marginBottom: 20,
  },
  headerSub: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 15,
    marginBottom: 20,
  },
  summaryTitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  macroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  macroCol: {
    alignItems: "center",
    gap: 4,
  },
  macroVal: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  macroLabel: {
    color: "#64748b",
    fontSize: 11,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 25,
  },
  scanBtn: {
    flex: 1,
    height: 48,
    backgroundColor: "#10b981",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  scanBtnText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "bold",
  },
  manualBtn: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  manualBtnText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "bold",
  },
  formCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 15,
    marginBottom: 25,
  },
  formTitle: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 16,
  },
  mealTypeToggle: {
    flexDirection: "row",
    backgroundColor: "#050b08",
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  typeBtn: {
    flex: 1,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBtnSelected: {
    backgroundColor: "#10b981",
  },
  typeBtnText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  typeBtnTextSelected: {
    color: "#050b08",
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  inputGroup: {
    width: "47%",
    gap: 6,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
  },
  input: {
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 10,
    height: 40,
    color: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
  },
  formActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 5,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "bold",
  },
  saveBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "bold",
  },
  historyHeader: {
    marginBottom: 15,
  },
  historyTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "bold",
  },
  scheduleContainer: {
    gap: 15,
  },
  scheduleSection: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  sectionHeader: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 6,
  },
  mealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30, 41, 59, 0.5)",
    paddingBottom: 10,
    marginBottom: 5,
  },
  mealLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  mealName: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 13,
  },
  mealMacros: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  mealVitamins: {
    color: "#10b981",
    fontSize: 10,
    marginTop: 2,
    fontStyle: "italic",
  },
  emptySessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  emptySessionText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
  },
});
