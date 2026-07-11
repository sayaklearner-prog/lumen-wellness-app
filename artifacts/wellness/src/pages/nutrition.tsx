import { useState, useRef } from "react";
import { useListMeals, useCreateMeal, useDeleteMeal, useRecognizeFood, getListMealsQueryKey, getGetTodayDashboardQueryKey } from "@workspace/api-client-react";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { MotionCard } from "@/components/ui/motion-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Plus, Trash2, Calendar, Check, X, Sparkles, PlusCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

export default function Nutrition() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date().toISOString().split('T')[0];
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: mealsData, isLoading: isMealsLoading } = useListMeals();
  const recognizeFood = useRecognizeFood();

  // Mutations
  const createMeal = useCreateMeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
        setPhotoPreview(null);
        setAnalysisResult(null);
        setIsScanOpen(false);
        setIsManualOpen(false);
        resetForm();
      }
    }
  });

  const deleteMeal = useDeleteMeal({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListMealsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
        toast({ title: "Meal deleted successfully" });
      }
    }
  });

  // Local state
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Manual Log Form State
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [calories, setCalories] = useState("350");
  const [protein, setProtein] = useState("20");
  const [carbs, setCarbs] = useState("45");
  const [fat, setFat] = useState("10");
  const [vitamins, setVitamins] = useState("");
  const [mealItemsText, setMealItemsText] = useState("");

  const todayMeals = mealsData?.filter(m => new Date(m.loggedAt).toISOString().split('T')[0] === today) || [];
  const allMeals = mealsData || [];

  const resetForm = () => {
    setName("");
    setMealType("breakfast");
    setCalories("350");
    setProtein("20");
    setCarbs("45");
    setFat("10");
    setVitamins("");
    setMealItemsText("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const base64Clean = base64.split(',')[1] || base64;
      setPhotoPreview(base64);
      setIsScanOpen(true);
      
      try {
        const res = await recognizeFood.mutateAsync({ data: { hint: file.name, image: base64Clean } });
        setAnalysisResult(res);
      } catch (err) {
        console.error(err);
        toast({ title: "Failed to scan image", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogScannedMeal = () => {
    if (!analysisResult) return;
    createMeal.mutate({
      data: {
        name: analysisResult.name || "Scanned Meal",
        mealType: analysisResult.mealType || "snack",
        calories: parseInt(analysisResult.calories) || 0,
        proteinGrams: parseInt(analysisResult.proteinGrams) || 0,
        carbsGrams: parseInt(analysisResult.carbsGrams) || 0,
        fatGrams: parseInt(analysisResult.fatGrams) || 0,
        vitamins: analysisResult.vitamins || "",
        source: "ai_camera",
        photoUrl: photoPreview,
        items: (Array.isArray(analysisResult.items) ? analysisResult.items : []).map((i: any) => ({
          name: i.name,
          quantity: i.quantity || "1 serving",
          calories: parseInt(i.calories) || 0,
          proteinGrams: parseInt(i.proteinGrams) || 0,
          carbsGrams: parseInt(i.carbsGrams) || 0,
          fatGrams: parseInt(i.fatGrams) || 0,
        }))
      }
    });
  };

  const handleLogManualMeal = () => {
    if (!name) {
      toast({ title: "Please enter a food name", variant: "destructive" });
      return;
    }
    const items = mealItemsText ? mealItemsText.split(',').map(item => ({
      name: item.trim(),
      quantity: "1 serving",
      calories: Math.round(parseInt(calories) / (mealItemsText.split(',').length || 1)),
      proteinGrams: Math.round(parseInt(protein) / (mealItemsText.split(',').length || 1)),
      carbsGrams: Math.round(parseInt(carbs) / (mealItemsText.split(',').length || 1)),
      fatGrams: Math.round(parseInt(fat) / (mealItemsText.split(',').length || 1)),
    })) : [];

    createMeal.mutate({
      data: {
        name,
        mealType,
        calories: parseInt(calories) || 0,
        proteinGrams: parseInt(protein) || 0,
        carbsGrams: parseInt(carbs) || 0,
        fatGrams: parseInt(fat) || 0,
        vitamins: vitamins || undefined,
        source: "manual",
        items
      }
    });
  };

  // Group meals for tabular view
  const groupedMeals = MEAL_TYPES.reduce((acc, type) => {
    acc[type] = todayMeals.filter(m => m.mealType === type);
    return acc;
  }, {} as Record<string, typeof todayMeals>);

  // Compute daily totals
  const totalNutrients = todayMeals.reduce((acc, m) => {
    acc.calories += m.calories || 0;
    acc.protein += m.proteinGrams || 0;
    acc.carbs += m.carbsGrams || 0;
    acc.fat += m.fatGrams || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  if (isMealsLoading) return <LoadingState title="Accessing Nutrition Engine..." />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
      {/* Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
            Nutrition Tracker
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm md:text-base">
            Snap food photos for automatic AI scans, or customize meals with precise nutrients.
          </p>
        </div>
        
        <div className="flex gap-3">
          <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
          
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 shadow-lg shadow-emerald-500/20"
          >
            <Camera className="w-5 h-5 mr-2" /> Scan Food Photo
          </Button>

          <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-emerald-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-950/40 rounded-full px-5">
                <Plus className="w-4 h-4 mr-2" /> Log Manually
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-emerald-950/95 border-slate-200 dark:border-emerald-900/50 text-slate-900 dark:text-slate-100 rounded-3xl backdrop-blur-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" /> Log Meal Manually
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-1">
                
                {/* Food Name */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Food Name</Label>
                  <Input 
                    placeholder="e.g. Scrambled Eggs with Avocado" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Meal Type Selection */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Meal Session</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMealType(t)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-semibold border capitalize transition-all",
                          mealType === t ? "bg-emerald-600 border-emerald-400 text-white" : "border-emerald-900/50 bg-emerald-950/20 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Core Macros */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Calories (kcal)</Label>
                    <Input 
                      type="number" 
                      value={calories} 
                      onChange={e => setCalories(e.target.value)}
                      className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Protein (g)</Label>
                    <Input 
                      type="number" 
                      value={protein} 
                      onChange={e => setProtein(e.target.value)}
                      className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Carbs (g)</Label>
                    <Input 
                      type="number" 
                      value={carbs} 
                      onChange={e => setCarbs(e.target.value)}
                      className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Fat (g)</Label>
                    <Input 
                      type="number" 
                      value={fat} 
                      onChange={e => setFat(e.target.value)}
                      className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Vitamins */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Vitamins & Minerals</Label>
                  <Input 
                    placeholder="e.g. Vitamin C: 12mg, Vitamin A: 15%" 
                    value={vitamins} 
                    onChange={e => setVitamins(e.target.value)}
                    className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Meal ingredients tags */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Ingredients (comma-separated)</Label>
                  <Input 
                    placeholder="e.g. Eggs, Toast, Avocado" 
                    value={mealItemsText} 
                    onChange={e => setMealItemsText(e.target.value)}
                    className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white"
                  />
                </div>

                <Button 
                  onClick={handleLogManualMeal}
                  disabled={createMeal.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-semibold mt-4"
                >
                  {createMeal.isPending ? "Adding meal record..." : "Log Nutrition Record"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Image Scan Confirmation Dialog */}
      <Dialog open={isScanOpen} onOpenChange={(open) => { setIsScanOpen(open); if(!open){ setPhotoPreview(null); setAnalysisResult(null); } }}>
        <DialogContent className="sm:max-w-md border-none bg-emerald-950/95 backdrop-blur-2xl shadow-2xl overflow-hidden rounded-3xl p-0">
          <div className="relative h-64 bg-muted">
            {photoPreview && <img src={photoPreview} alt="Food Scan" className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 to-transparent" />
            <Button variant="ghost" size="icon" className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm rounded-full text-white" onClick={() => setIsScanOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="p-6 pt-0 space-y-4 relative z-10 text-slate-900 dark:text-slate-100">
            {recognizeFood.isPending ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
                <h3 className="font-semibold text-lg">AI Nutrition Scan Active...</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">Identifying ingredients, estimating vitamins & portion sizing</p>
              </div>
            ) : analysisResult ? (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-bold">{analysisResult.name}</h3>
                    <Badge variant="secondary" className="capitalize bg-emerald-800 text-white">{analysisResult.mealType}</Badge>
                  </div>
                  {analysisResult.notes && <p className="text-xs text-emerald-700 dark:text-emerald-400 italic mb-4">"{analysisResult.notes}"</p>}
                </div>
                
                {/* Tabular Estimation Summary */}
                <div className="grid grid-cols-4 gap-2 text-center p-4 bg-emerald-900/20 border border-emerald-900/40 rounded-2xl">
                  <div><div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysisResult.calories}</div><div className="text-[10px] text-slate-600 dark:text-slate-400">kcal</div></div>
                  <div><div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysisResult.proteinGrams}g</div><div className="text-[10px] text-slate-600 dark:text-slate-400">Protein</div></div>
                  <div><div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysisResult.carbsGrams}g</div><div className="text-[10px] text-slate-600 dark:text-slate-400">Carbs</div></div>
                  <div><div className="text-xl font-bold text-slate-800 dark:text-slate-200">{analysisResult.fatGrams}g</div><div className="text-[10px] text-slate-600 dark:text-slate-400">Fat</div></div>
                </div>

                {analysisResult.vitamins && (
                  <div className="p-3 bg-emerald-950 border border-emerald-900/40 rounded-xl">
                    <span className="text-xs text-slate-600 dark:text-slate-400 block font-semibold mb-1">Estimated Vitamins</span>
                    <p className="text-xs text-emerald-600 dark:text-emerald-300">{analysisResult.vitamins}</p>
                  </div>
                )}

                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  <div className="text-xs font-semibold mb-2 text-slate-600 dark:text-slate-400">Detected Ingredients</div>
                  {(Array.isArray(analysisResult.items) ? analysisResult.items : []).map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-slate-50 dark:bg-emerald-950 border-slate-200 dark:border-emerald-900/20 rounded-xl">
                      <span className="text-slate-700 dark:text-slate-300">{item.name} <span className="text-slate-500 dark:text-slate-500 text-[10px]">({item.quantity})</span></span>
                      <span className="font-semibold text-slate-600 dark:text-slate-400">{item.calories} kcal</span>
                    </div>
                  ))}
                </div>

                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold" onClick={handleLogScannedMeal} disabled={createMeal.isPending}>
                  <Check className="w-5 h-5 mr-2" /> Log verified meal
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Main View Selection */}
      <div className="flex gap-4">
        <Button variant={activeTab === "today" ? "default" : "outline"} className={cn("rounded-full px-6", activeTab === "today" ? "bg-emerald-600" : "border-emerald-900/40 text-slate-600 dark:text-slate-400")} onClick={() => setActiveTab("today")}>Today's Logs</Button>
        <Button variant={activeTab === "history" ? "default" : "outline"} className={cn("rounded-full px-6", activeTab === "history" ? "bg-emerald-600" : "border-emerald-900/40 text-slate-600 dark:text-slate-400")} onClick={() => setActiveTab("history")}>Nutrition History</Button>
      </div>

      {activeTab === "today" ? (
        <div className="space-y-6">
          {/* Daily Goals Summary Widget */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-emerald-900/30 dark:border-emerald-900/30 bg-emerald-950/5 dark:bg-emerald-950/10 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Calories Consumed</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalNutrients.calories} / 2200 kcal</p>
                <div className="w-full bg-emerald-950/40 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min((totalNutrients.calories / 2200) * 100, 100)}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-900/30 dark:border-emerald-900/30 bg-emerald-950/5 dark:bg-emerald-950/10 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Total Protein</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalNutrients.protein} / 120g</p>
                <div className="w-full bg-emerald-950/40 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min((totalNutrients.protein / 120) * 100, 100)}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-900/30 dark:border-emerald-900/30 bg-emerald-950/5 dark:bg-emerald-950/10 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Total Carbs</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalNutrients.carbs}g</p>
                <div className="w-full bg-emerald-950/40 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min((totalNutrients.carbs / 250) * 100, 100)}%` }} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-900/30 dark:border-emerald-900/30 bg-emerald-950/5 dark:bg-emerald-950/10 backdrop-blur-xl">
              <CardContent className="p-4 text-center">
                <span className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Total Fat</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalNutrients.fat}g</p>
                <div className="w-full bg-emerald-950/40 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min((totalNutrients.fat / 70) * 100, 100)}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Grouped Tabular Format of Daily Meals */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Daily Meal Schedule</h3>
            
            <div className="border border-emerald-900/30 rounded-3xl overflow-hidden bg-emerald-950/10 backdrop-blur-xl">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-emerald-900/20 border-b border-emerald-900/30 text-slate-600 dark:text-slate-400 font-semibold">
                    <th className="p-4">Session</th>
                    <th className="p-4">Logged Meal Name</th>
                    <th className="p-4 text-center">Calories</th>
                    <th className="p-4 text-center">Protein</th>
                    <th className="p-4 text-center">Carbs</th>
                    <th className="p-4 text-center">Fat</th>
                    <th className="p-4">Vitamins</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-900/20">
                  {MEAL_TYPES.map((type) => {
                    const meals = groupedMeals[type] || [];
                    if (meals.length === 0) {
                      return (
                        <tr key={type} className="text-slate-500 dark:text-slate-500">
                          <td className="p-4 font-bold capitalize text-emerald-700 dark:text-emerald-400">{type}</td>
                          <td className="p-4 italic" colSpan={6}>No food logged in this session yet</td>
                          <td className="p-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-emerald-500 hover:bg-emerald-900/10 rounded-lg"
                              onClick={() => { setMealType(type); setIsManualOpen(true); }}
                            >
                              + Log
                            </Button>
                          </td>
                        </tr>
                      );
                    }

                    return meals.map((meal, index) => (
                      <tr key={meal.id} className="hover:bg-emerald-950/20 text-slate-700 dark:text-slate-300">
                        {index === 0 && (
                          <td className="p-4 font-bold capitalize text-emerald-700 dark:text-emerald-400 border-r border-slate-200 dark:border-emerald-900/20" rowSpan={meals.length}>
                            {type}
                          </td>
                        )}
                        <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            {meal.name}
                            {meal.source === "ai_camera" && (
                              <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                                AI
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center font-semibold text-slate-800 dark:text-slate-200">{meal.calories} kcal</td>
                        <td className="p-4 text-center">{meal.proteinGrams}g</td>
                        <td className="p-4 text-center">{meal.carbsGrams}g</td>
                        <td className="p-4 text-center">{meal.fatGrams}g</td>
                        <td className="p-4 text-slate-600 dark:text-slate-400 italic max-w-xs truncate">{meal.vitamins || "—"}</td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={deleteMeal.isPending}
                            className="text-slate-500 dark:text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-xl"
                            onClick={() => deleteMeal.mutate({ mealId: String(meal.id) })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* History View */
        <div className="space-y-4">
          {allMeals.length > 0 ? (
            allMeals.map(meal => (
              <MotionCard key={meal.id} className="border-emerald-900/30 dark:border-emerald-900/30 bg-emerald-950/5 dark:bg-emerald-950/10">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-1">{format(new Date(meal.loggedAt), "PPP p")}</div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200">{meal.name}</h4>
                      <Badge variant="secondary" className="capitalize text-[10px] h-5 bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">{meal.mealType}</Badge>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {meal.calories} kcal • {meal.proteinGrams}g protein • {meal.carbsGrams}g carbs • {meal.fatGrams}g fat
                      {meal.vitamins && ` • ${meal.vitamins}`}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-slate-500 dark:text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-xl" 
                    disabled={deleteMeal.isPending} 
                    onClick={() => deleteMeal.mutate({ mealId: String(meal.id) })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </MotionCard>
            ))
          ) : (
            <div className="py-12 text-center border border-dashed border-emerald-900/30 rounded-3xl">
              <Calendar className="w-8 h-8 text-slate-500 dark:text-slate-500 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400 text-sm">No historical logs found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}