import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListWorkouts,
  useCreateWorkout,
  useUpdateWorkouts,
  useDeleteWorkouts,
  useGenerateWorkoutSummary,
  useGetWorkoutReadiness,
  useGetWorkoutInsights,
  useGetWorkoutChallenges,
  getListWorkoutsQueryKey,
  getGetWorkoutReadinessQueryKey,
  getGetWorkoutInsightsQueryKey,
  getGetWorkoutChallengesQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/loading-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, subDays, startOfDay } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Activity,
  Plus,
  Trash2,
  TrendingUp,
  Flame,
  Clock,
  Heart,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Sparkles,
  Smartphone,
  Info,
  ChevronRight,
  Smile,
  Zap,
  Target,
  Edit2,
  RefreshCw
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/motion-card";

const ACTIVITY_TYPES = [
  { id: "walking", label: "Walking", icon: "🚶" },
  { id: "running", label: "Running", icon: "🏃" },
  { id: "cycling", label: "Cycling", icon: "🚴" },
  { id: "gym_workout", label: "Gym Workout", icon: "🏋️" },
  { id: "yoga", label: "Yoga", icon: "🧘" },
  { id: "strength_training", label: "Strength Training", icon: "💪" },
  { id: "hiit", label: "HIIT", icon: "⚡" },
  { id: "swimming", label: "Swimming", icon: "🏊" },
  { id: "hiking", label: "Hiking", icon: "🥾" },
  { id: "stretching", label: "Stretching", icon: "🤸" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "dance", label: "Dance", icon: "💃" },
  { id: "other", label: "Other", icon: "✨" }
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export default function ActivityPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Queries
  const { data: workouts, isLoading } = useListWorkouts();
  const { data: readiness } = useGetWorkoutReadiness({
    query: { queryKey: getGetWorkoutReadinessQueryKey() }
  });
  const { data: insights } = useGetWorkoutInsights({
    query: { queryKey: getGetWorkoutInsightsQueryKey() }
  });
  const { data: challenges } = useGetWorkoutChallenges({
    query: { queryKey: getGetWorkoutChallengesQueryKey() }
  });

  // Mutations
  const createWorkout = useCreateWorkout();
  const updateWorkout = useUpdateWorkouts();
  const deleteWorkout = useDeleteWorkouts();
  const getAISummary = useGenerateWorkoutSummary();

  // Local state
  const [open, setOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState("running");
  const [duration, setDuration] = useState("30");
  const [calories, setCalories] = useState("300");
  const [distance, setDistance] = useState("5");
  const [steps, setSteps] = useState("6000");
  const [heartRate, setHeartRate] = useState("145");
  const [intensity, setIntensity] = useState("moderate");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "calories-desc" | "duration-desc">("date-desc");
  const [chartMetric, setChartMetric] = useState<"calories" | "steps" | "duration">("calories");
  const [chartTimeframe, setChartTimeframe] = useState<"week" | "month">("week");

  // Simulation Wearables state
  const [deviceConnected, setDeviceConnected] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Quick AI summary state
  const [aiEvaluations, setAiEvaluations] = useState<Record<string, string>>({});
  const [readinessDrawerOpen, setReadinessDrawerOpen] = useState(false);

  // Invalidate queries helper
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
    qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetWorkoutChallengesQueryKey() });
  };

  const handleCreateOrUpdate = async () => {
    try {
      const payload = {
        type: selectedType,
        durationMinutes: parseInt(duration) || 0,
        caloriesBurned: parseInt(calories) || 0,
        steps: parseInt(steps) || 0,
        intensity,
        distanceKm: distance ? parseFloat(distance) : undefined,
        avgHeartRate: heartRate ? parseInt(heartRate) : undefined,
        notes: notes || undefined,
        source: deviceConnected ? "wearable" : "manual"
      };

      if (editingWorkout) {
        await updateWorkout.mutateAsync({ id: editingWorkout.id, data: payload });
        toast({ title: "Workout updated", description: "Your workout has been successfully updated." });
      } else {
        await createWorkout.mutateAsync({ data: payload });
        toast({ title: "Workout saved", description: "Your workout has been securely stored." });
      }
      refreshAll();
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: editingWorkout ? "Error updating workout" : "Error saving workout", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkout.mutateAsync({ id });
      refreshAll();
      toast({ title: "Workout deleted" });
    } catch {
      toast({ title: "Error deleting workout", variant: "destructive" });
    }
  };

  const handleEdit = (workout: any) => {
    setEditingWorkout(workout);
    setSelectedType(workout.type || "running");
    setDuration(workout.durationMinutes?.toString() || "30");
    setCalories(workout.caloriesBurned?.toString() || "300");
    setDistance(workout.distanceKm?.toString() || "");
    setSteps(workout.steps?.toString() || "");
    setHeartRate(workout.avgHeartRate?.toString() || "");
    setIntensity(workout.intensity || "moderate");
    setNotes(workout.notes || "");
    setOpen(true);
  };

  const requestAISummary = async (id: string) => {
    if (aiEvaluations[id]) return;
    try {
      const res = await getAISummary.mutateAsync({ id });
      setAiEvaluations(prev => ({ ...prev, [id]: res.summary }));
    } catch {
      toast({ title: "AI analysis failed", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setEditingWorkout(null);
    setSelectedType("running");
    setDuration("30");
    setCalories("300");
    setDistance("5");
    setSteps("6000");
    setHeartRate("145");
    setIntensity("moderate");
    setNotes("");
  };

  // 1. Calculations & Metrics (Today's Totals)
  const todayTotals = useMemo(() => {
    if (!workouts) return { steps: 0, calories: 0, duration: 0, count: 0 };
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayWorkouts = workouts.filter((w: any) =>
      w.loggedAt && format(new Date(w.loggedAt), "yyyy-MM-dd") === todayStr
    );
    return {
      steps: todayWorkouts.reduce((sum, w) => sum + (w.steps || 0), 0),
      calories: todayWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0),
      duration: todayWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0),
      count: todayWorkouts.length
    };
  }, [workouts]);

  // 2. Personal Records Board
  const personalRecords = useMemo(() => {
    if (!workouts || workouts.length === 0) return null;
    return {
      longestWorkout: [...workouts].sort((a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0))[0],
      mostCalories: [...workouts].sort((a, b) => (b.caloriesBurned || 0) - (a.caloriesBurned || 0))[0],
      highestSteps: [...workouts].sort((a, b) => (b.steps || 0) - (a.steps || 0))[0],
      longestDistance: [...workouts].filter(w => w.distanceKm).sort((a, b) => (b.distanceKm || 0) - (a.distanceKm || 0))[0]
    };
  }, [workouts]);

  // 3. Weekly Active Minutes Calculation
  const weeklyMinutes = useMemo(() => {
    if (!workouts) return 0;
    const oneWeekAgo = subDays(new Date(), 7);
    return workouts
      .filter((w: any) => w.loggedAt && new Date(w.loggedAt) >= oneWeekAgo)
      .reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  }, [workouts]);

  // 4. Filtered & Sorted workout timeline
  const filteredWorkouts = useMemo(() => {
    if (!workouts) return [];
    return workouts
      .filter((w: any) => {
        const matchesSearch = w.type.toLowerCase().includes(search.toLowerCase()) ||
          (w.notes && w.notes.toLowerCase().includes(search.toLowerCase()));
        const matchesFilter = filterType === "all" || w.type === filterType;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortBy === "date-desc") {
          return new Date(b.loggedAt || 0).getTime() - new Date(a.loggedAt || 0).getTime();
        }
        if (sortBy === "date-asc") {
          return new Date(a.loggedAt || 0).getTime() - new Date(b.loggedAt || 0).getTime();
        }
        if (sortBy === "calories-desc") {
          return (b.caloriesBurned || 0) - (a.caloriesBurned || 0);
        }
        if (sortBy === "duration-desc") {
          return (b.durationMinutes || 0) - (a.durationMinutes || 0);
        }
        return 0;
      });
  }, [workouts, search, filterType, sortBy]);

  // 5. GitHub-style heatmap simulation
  const heatmapDays = useMemo(() => {
    const days = [];
    const today = startOfDay(new Date());
    for (let i = 27; i >= 0; i--) {
      const d = subDays(today, i);
      const hasWorkout = workouts?.some((w: any) =>
        w.loggedAt && format(new Date(w.loggedAt), "yyyy-MM-dd") === format(d, "yyyy-MM-dd")
      );
      days.push({ date: d, active: hasWorkout });
    }
    return days;
  }, [workouts]);

  // 6. Interactive Chart Data
  const chartData = useMemo(() => {
    if (!workouts) return [];
    const sorted = [...workouts].sort((a, b) => new Date(a.loggedAt || 0).getTime() - new Date(b.loggedAt || 0).getTime());
    return chartTimeframe === "week" ? sorted.slice(-7) : sorted.slice(-30);
  }, [workouts, chartTimeframe]);

  const triggerWearableSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      refreshAll();
      toast({ title: "Wearable synced", description: "Successfully updated step count & workouts." });
    }, 1500);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  if (isLoading) return <LoadingState title="Loading Fitness Engine..." />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-32">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">

        {/* Header Title Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <Activity className="w-10 h-10 text-emerald-500" /> AI Fitness Hub
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm md:text-base">
              Precision metrics, wearable integrations, and customized biometric summaries.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-slate-200 dark:border-emerald-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:bg-emerald-950/40 rounded-full"
              onClick={triggerWearableSync}
              disabled={syncing}
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-emerald-500 animate-spin" /> Syncing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-500" /> Sync Watch
                </span>
              )}
            </Button>

            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 shadow-lg shadow-emerald-500/20">
                  <Plus className="w-4 h-4 mr-2" /> Log Activity
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px] bg-emerald-950/95 border-slate-200 dark:border-emerald-900/50 text-slate-900 dark:text-slate-100 rounded-3xl backdrop-blur-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-700 dark:text-emerald-400" /> {editingWorkout ? "Edit Workout Record" : "Log New Workout"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto pr-1">

                  {/* Select Type */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Activity Type</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {ACTIVITY_TYPES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedType(t.id)}
                          className={cn(
                            "py-2 px-1 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1",
                            selectedType === t.id ? "bg-emerald-600 border-emerald-400 text-white" : "border-slate-200 dark:border-emerald-900/50 bg-slate-50 dark:bg-emerald-950/20 text-slate-600 dark:text-slate-400"
                          )}
                        >
                          <span className="text-lg">{t.icon}</span>
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Core Metrics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Duration (mins)</Label>
                      <Input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Calories Burned (kcal)</Label>
                      <Input
                        type="number"
                        value={calories}
                        onChange={(e) => setCalories(e.target.value)}
                        className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Distance (km)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Steps</Label>
                      <Input
                        type="number"
                        value={steps}
                        onChange={(e) => setSteps(e.target.value)}
                        className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-300">Avg HR (bpm)</Label>
                      <Input
                        type="number"
                        value={heartRate}
                        onChange={(e) => setHeartRate(e.target.value)}
                        className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Intensity */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Intensity</Label>
                    <div className="flex gap-2">
                      {["light", "moderate", "vigorous", "peak"].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setIntensity(lvl)}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-xs font-semibold border capitalize transition-all",
                            intensity === lvl ? "bg-emerald-600 border-emerald-400 text-white" : "border-slate-200 dark:border-emerald-900/50 bg-slate-50 dark:bg-emerald-950/20 text-slate-600 dark:text-slate-400"
                          )}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Personal Log Notes</Label>
                    <Textarea
                      placeholder="Felt strong during intervals, slightly fatigued at finish."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-slate-200 dark:border-emerald-800 text-slate-900 dark:text-white resize-none h-20 focus-visible:ring-emerald-500"
                    />
                  </div>

                  <Button
                    onClick={handleCreateOrUpdate}
                    disabled={createWorkout.isPending || updateWorkout.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-semibold mt-4"
                  >
                    {createWorkout.isPending || updateWorkout.isPending ? "Saving changes..." : editingWorkout ? "Update Activity Record" : "Log Activity Record"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* SECTION 1 — Today's Activity Summary & AI Readiness */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* AI Readiness Score Card */}
          <motion.div variants={item} className="md:col-span-1">
            <GlassCard className="border-slate-200 dark:border-slate-200 dark:border-emerald-800/40 bg-slate-50 dark:bg-emerald-950/15 h-full flex flex-col justify-between">
              <CardContent className="p-6 flex flex-col items-center text-center justify-between h-full gap-4">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">AI Biometrics</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400">Daily</Badge>
                </div>

                <div className="relative flex items-center justify-center my-2">
                  {/* Gauge score circle */}
                  <div className="w-32 h-32 rounded-full border-4 border-slate-200 dark:border-emerald-900/40 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-slate-900 dark:text-slate-100">{readiness?.readinessScore ?? 75}</span>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mt-0.5">Readiness</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic px-2">
                    "{readiness?.explanation ?? 'Hydrate well and aim for a structured run to boost your score today.'}"
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-emerald-700 dark:text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/10 rounded-full"
                  onClick={() => setReadinessDrawerOpen(!readinessDrawerOpen)}
                >
                  <Info className="w-4 h-4 mr-2" /> Detail Analysis <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </CardContent>
            </GlassCard>
          </motion.div>

          {/* Core metrics details */}
          <motion.div variants={item} className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-emerald-950/10 border border-slate-200 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Active Calories</span>
                <Flame className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{todayTotals.calories}</span>
                <span className="text-slate-500 dark:text-slate-500 text-xs ml-1">/ 500 kcal</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-emerald-950/40 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min((todayTotals.calories / 500) * 100, 100)}%` }} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-emerald-950/10 border border-slate-200 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Steps Counter</span>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{todayTotals.steps}</span>
                <span className="text-slate-500 dark:text-slate-500 text-xs ml-1">/ 10k steps</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-emerald-950/40 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min((todayTotals.steps / 10000) * 100, 100)}%` }} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-emerald-950/10 border border-slate-200 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Active Minutes</span>
                <Clock className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{todayTotals.duration}</span>
                <span className="text-slate-500 dark:text-slate-500 text-xs ml-1">min</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-emerald-950/40 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min((todayTotals.duration / 60) * 100, 100)}%` }} />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-emerald-950/10 border border-slate-200 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold">Logged Count</span>
                <Activity className="w-5 h-5 text-blue-750 dark:text-blue-400" />
              </div>
              <div className="mt-4">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{todayTotals.count}</span>
                <span className="text-slate-500 dark:text-slate-500 text-xs ml-1">sessions</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-emerald-950/40 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min((todayTotals.count / 3) * 100, 100)}%` }} />
              </div>
            </div>
          </motion.div>

        </div>

        {/* Readiness Detailed Analysis Drawer */}
        <AnimatePresence>
          {readinessDrawerOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="border-slate-200 dark:border-emerald-850 bg-slate-50 dark:bg-emerald-950/10">
                <CardContent className="p-6 space-y-4">
                  <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Readiness Biometrics Breakdown
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="p-3 bg-slate-100 dark:bg-emerald-950/30 rounded-xl border border-slate-200 dark:border-emerald-900/40">
                      <span className="text-slate-600 dark:text-slate-400">Sleep Score contribution</span>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">Excellent (82%)</p>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-emerald-950/30 rounded-xl border border-slate-200 dark:border-emerald-900/40">
                      <span className="text-slate-600 dark:text-slate-400">Hydration target</span>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">Optimizing (+500ml)</p>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-emerald-950/30 rounded-xl border border-slate-200 dark:border-emerald-900/40">
                      <span className="text-slate-600 dark:text-slate-400">Active strain today</span>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">Balanced Load</p>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-emerald-950/30 rounded-xl border border-slate-200 dark:border-emerald-900/40">
                      <span className="text-slate-600 dark:text-slate-400">Mood correlation</span>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-200 mt-1">Strong / Energetic</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SECTION 4 — Weekly/Monthly Analytics Charts */}
        <motion.div variants={item}>
          <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-emerald-950/10 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Biometric Trend Charts</h2>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">Monitor calories, steps, and duration trends</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  {/* Timeframe selector */}
                  <div className="flex bg-emerald-950/50 p-1 rounded-full border border-slate-200 dark:border-emerald-900/40">
                    <button
                      onClick={() => setChartTimeframe("week")}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                        chartTimeframe === "week" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200"
                      )}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => setChartTimeframe("month")}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                        chartTimeframe === "month" ? "bg-emerald-600 text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200"
                      )}
                    >
                      Month
                    </button>
                  </div>

                  {/* Metric Selectors */}
                  <div className="flex gap-2">
                    {["calories", "steps", "duration"].map((metric) => (
                      <Button
                        key={metric}
                        size="sm"
                        variant={chartMetric === metric ? "default" : "outline"}
                        className={cn(
                          "rounded-full text-xs font-semibold capitalize",
                          chartMetric === metric ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-slate-200 dark:border-emerald-900/40 text-slate-600 dark:text-slate-400"
                        )}
                        onClick={() => setChartMetric(metric as any)}
                      >
                        {metric}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="loggedAt"
                      tickFormatter={(val) => val ? format(new Date(val), "MMM dd") : ""}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", background: "rgba(0,0,0,0.85)", color: "#fff" }}
                      labelFormatter={(val) => val ? format(new Date(val), "PPP p") : ""}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartMetric === "calories" ? "caloriesBurned" : chartMetric === "steps" ? "steps" : "durationMinutes"}
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#metricGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* SECTION 8 & 9 — Activity Insights & Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <motion.div variants={item}>
            <GlassCard className="h-full border-slate-200 dark:border-emerald-900/30">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> AI Fitness Insights
                </h3>
                <div className="space-y-3">
                  {insights?.insights.map((insight: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 text-xs bg-slate-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-slate-200 dark:border-emerald-900/35">
                      <Zap className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{insight}</p>
                    </div>
                  )) ?? (
                      <p className="text-xs text-slate-500 dark:text-slate-500">Log more workouts to generate personalized insights.</p>
                    )}
                </div>
              </CardContent>
            </GlassCard>
          </motion.div>

          <motion.div variants={item}>
            <GlassCard className="h-full border-slate-200 dark:border-emerald-900/30">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Personal Weekly Challenges
                </h3>
                <div className="space-y-3">
                  {challenges?.challenges.map((challenge: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{challenge}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">Active</Badge>
                    </div>
                  )) ?? (
                      <p className="text-xs text-slate-500 dark:text-slate-500">Load challenges to start optimizing your goals.</p>
                    )}
                </div>
              </CardContent>
            </GlassCard>
          </motion.div>

        </div>

        {/* SECTION 5 & 11 — Workout History Timeline & Consistency Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Heatmap & Records */}
          <div className="lg:col-span-1 space-y-6">

            {/* Goals Tracker Card */}
            <motion.div variants={item}>
              <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-emerald-950/10 backdrop-blur-xl">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Goals Tracker
                  </h3>
                  <div className="space-y-4 text-xs">
                    {/* Steps Goal */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">Daily Steps</span>
                        <span className="text-slate-800 dark:text-slate-200">{todayTotals.steps} / 10,000</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-emerald-950/40 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min((todayTotals.steps / 10000) * 100, 100)}%` }} />
                      </div>
                    </div>

                    {/* Calories Goal */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">Daily Calories</span>
                        <span className="text-slate-800 dark:text-slate-200">{todayTotals.calories} / 500 kcal</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-emerald-950/40 h-2 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min((todayTotals.calories / 500) * 100, 100)}%` }} />
                      </div>
                    </div>

                    {/* Weekly Active Minutes Goal */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">Weekly Active Time</span>
                        <span className="text-slate-800 dark:text-slate-200">{weeklyMinutes} / 150 min</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-emerald-950/40 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${Math.min((weeklyMinutes / 150) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Heatmap Card */}
            <motion.div variants={item}>
              <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-emerald-950/10 backdrop-blur-xl">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Consistency Calendar
                  </h3>
                  <div className="grid grid-cols-7 gap-2">
                    {heatmapDays.map((d, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "aspect-square rounded-md flex items-center justify-center text-[8px] font-bold transition-all",
                          d.active ? "bg-emerald-500 text-slate-900 scale-105" : "bg-slate-200 dark:bg-emerald-950/40 text-slate-600 border border-emerald-900/20"
                        )}
                        title={format(d.date, "yyyy-MM-dd")}
                      >
                        {format(d.date, "d")}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-500 px-1 pt-1">
                    <span>28 Days Ago</span>
                    <span>Today</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Personal Records Card */}
            <motion.div variants={item}>
              <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-emerald-950/10 backdrop-blur-xl">
                <CardContent className="p-5 space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Personal Records
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-b border-emerald-900/20">
                      <span className="text-slate-600 dark:text-slate-400">Longest Duration</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{personalRecords?.longestWorkout?.durationMinutes ?? "—"} min</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-b border-emerald-900/20">
                      <span className="text-slate-600 dark:text-slate-400">Most Calories</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{personalRecords?.mostCalories?.caloriesBurned ?? "—"} kcal</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-b border-emerald-900/20">
                      <span className="text-slate-600 dark:text-slate-400">Highest Steps</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{personalRecords?.highestSteps?.steps ?? "—"} steps</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-600 dark:text-slate-400">Longest Distance</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{personalRecords?.longestDistance?.distanceKm ?? "—"} km</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

          </div>

          {/* Workout History Timeline */}
          <div className="lg:col-span-2 space-y-4">

            {/* Search, Filter, Sort Row */}
            <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-500" />
                <Input
                  placeholder="Search workouts or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-50 dark:bg-emerald-950/10 border-slate-200 dark:border-emerald-900/30 pl-10 focus-visible:ring-emerald-500"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-emerald-950 border-slate-200 dark:border-emerald-900/40 text-slate-800 dark:text-slate-200 rounded-xl px-3 h-10 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">All Activities</option>
                    {ACTIVITY_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-emerald-950 border-slate-200 dark:border-emerald-900/40 text-slate-800 dark:text-slate-200 rounded-xl px-3 h-10 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="calories-desc">Most Calories</option>
                    <option value="duration-desc">Longest Duration</option>
                  </select>
                </div>
              </div>
            </motion.div>

            {/* History Cards */}
            <div className="space-y-4">
              {filteredWorkouts.length > 0 ? (
                filteredWorkouts.map((workout: any) => {
                  const typeObj = ACTIVITY_TYPES.find(t => t.id === workout.type) || { icon: "🏋️" };
                  return (
                    <motion.div key={workout.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group">
                      <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-emerald-950/15 hover:bg-slate-100 dark:bg-emerald-950/30 transition-all">
                        <CardContent className="p-5 space-y-4">

                          {/* Top Row: Type, Edit, Delete & AI summary */}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl p-2 bg-slate-100 dark:bg-emerald-900/30 rounded-2xl">{typeObj.icon}</span>
                              <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-200 capitalize">{workout.type.replace("_", " ")}</h4>
                                <span className="text-[10px] text-slate-500 dark:text-slate-500">{workout.loggedAt ? format(new Date(workout.loggedAt), "PPP p") : "Unknown"}</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => requestAISummary(workout.id)}
                                className="p-1.5 bg-emerald-900/20 hover:bg-emerald-800/40 text-emerald-700 dark:text-emerald-400 rounded-xl transition-all"
                                title="Get AI Summary"
                              >
                                <Sparkles className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(workout)}
                                className="p-1.5 hover:bg-slate-200 dark:bg-emerald-950/40 text-slate-500 dark:text-slate-500 hover:text-emerald-700 dark:text-emerald-400 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                title="Edit Workout"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(workout.id)}
                                className="p-1.5 hover:bg-red-950/40 text-slate-500 dark:text-slate-500 hover:text-red-400 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                title="Delete Workout"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="bg-slate-50 dark:bg-emerald-950/10 p-2 rounded-xl border border-emerald-900/20">
                              <span className="text-slate-500 dark:text-slate-500">Duration</span>
                              <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{workout.durationMinutes}m</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-emerald-950/10 p-2 rounded-xl border border-emerald-900/20">
                              <span className="text-slate-500 dark:text-slate-500">Calories</span>
                              <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{workout.caloriesBurned}k</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-emerald-950/10 p-2 rounded-xl border border-emerald-900/20">
                              <span className="text-slate-500 dark:text-slate-500">Distance</span>
                              <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{workout.distanceKm || "—"} km</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-emerald-950/10 p-2 rounded-xl border border-emerald-900/20">
                              <span className="text-slate-500 dark:text-slate-500">Avg HR</span>
                              <p className="font-bold text-slate-700 dark:text-slate-300 mt-0.5">{workout.avgHeartRate || "—"} bpm</p>
                            </div>
                          </div>

                          {/* AI Evaluation Block */}
                          {aiEvaluations[workout.id] && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                              <p className="italic">"{aiEvaluations[workout.id]}"</p>
                            </div>
                          )}

                          {/* Workout Notes */}
                          {workout.notes && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-emerald-950/10 p-3 rounded-xl border border-emerald-900/20">
                              Notes: {workout.notes}
                            </p>
                          )}

                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              ) : (
                <div className="py-12 text-center border border-dashed border-slate-200 dark:border-emerald-900/30 rounded-3xl">
                  <Activity className="w-8 h-8 text-slate-500 dark:text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 text-sm">No matching activities found.</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </motion.div>
    </div>
  );
}
