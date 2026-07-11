import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  useGetMyProfile, 
  useUpdateMyProfile, 
  useListReminders, 
  useCreateReminder, 
  useUpdateReminder, 
  useDeleteReminder,
  getListRemindersQueryKey
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/loading-state";
import { useToast } from "@/hooks/use-toast";
import { Sliders, ShieldCheck, Bell, Trash2, Plus, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "standard", title: "Standard", desc: "Balanced approach for general wellness" },
  { id: "diabetes", title: "Diabetes", desc: "Focus on blood sugar and carb tracking" },
  { id: "heart_health", title: "Heart Health", desc: "Prioritize sodium and cardio" },
  { id: "weight_loss", title: "Weight Loss", desc: "Caloric deficit and high protein" },
  { id: "pregnancy", title: "Pregnancy", desc: "Prenatal nutrition and gentle activity" },
];

export default function SettingsPage() {
  const { data: profile, isLoading } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders, isLoading: isLoadingReminders } = useListReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState("08:00");
  const [newReminderTitle, setNewReminderTitle] = useState("");


  // State
  const [name, setName] = useState("");
  const [mode, setMode] = useState("standard");
  const [calTarget, setCalTarget] = useState("2100");
  const [proteinTarget, setProteinTarget] = useState("110");
  const [stepsTarget, setStepsTarget] = useState("9000");
  const [sleepTarget, setSleepTarget] = useState("8");
  const [screenTimeTarget, setScreenTimeTarget] = useState("180");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setMode(profile.mode || "standard");
      const p = profile as any;
      setCalTarget(p.dailyCalorieTarget?.toString() || "2100");
      setProteinTarget(p.dailyProteinTarget?.toString() || "110");
      setStepsTarget(p.dailyStepsTarget?.toString() || "9000");
      setSleepTarget(p.dailySleepTargetHours?.toString() || "8");
      setScreenTimeTarget(p.dailyScreenTimeLimitMinutes?.toString() || "180");
    }
  }, [profile]);

  if (isLoading) {
    return <LoadingState title="Loading Settings" />;
  }

  // Real-time autosave or save on blur/change
  const handleSave = () => {
    if (isSaving) return;
    setIsSaving(true);
    updateProfile.mutate(
      {
        data: {
          name,
          mode,
          dailyCalorieTarget: parseInt(calTarget) || 2100,
          dailyProteinTarget: parseInt(proteinTarget) || 110,
          dailyStepsTarget: parseInt(stepsTarget) || 9000,
          dailySleepTargetHours: parseFloat(sleepTarget) || 8.0,
          dailyScreenTimeLimitMinutes: parseInt(screenTimeTarget) || 180,
        } as any // cast for now since we just regenerated
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getGetMyProfile"] });
          toast({
            title: "Settings saved",
            description: "Your profile has been updated.",
          });
          setIsSaving(false);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update settings.",
            variant: "destructive",
          });
          setIsSaving(false);
        }
      }
    );
  };

  const handleModeChange = (newMode: string) => {
    setMode(newMode);
    // Let's delay save slightly to ensure state is set, or just use newMode directly
    setIsSaving(true);
    updateProfile.mutate(
      {
        data: {
          name,
          mode: newMode,
          dailyCalorieTarget: parseInt(calTarget),
          dailyProteinTarget: parseInt(proteinTarget),
          dailyStepsTarget: parseInt(stepsTarget),
          dailySleepTargetHours: parseFloat(sleepTarget),
          dailyScreenTimeLimitMinutes: parseInt(screenTimeTarget),
        } as any
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getGetMyProfile"] });
          setIsSaving(false);
          toast({ title: "Health mode updated" });
        },
        onError: () => setIsSaving(false)
      }
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 text-slate-900 dark:text-slate-100">Settings</h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Manage your profile, targets, and reminders
            </p>
          </div>
          <button 
            onClick={handleSave} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
          </button>
        </div>

        <div className="space-y-6">
          {/* PROFILE & TARGETS */}
          <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/10 backdrop-blur-xl shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Sliders className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Profile & Targets</h2>
              </div>

              <div className="space-y-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Name</Label>
                  <Input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSave}
                    className="bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border-slate-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500/50"
                  />
                </div>

                {/* Health Mode */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-700 dark:text-slate-300">Health Mode</Label>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Lumen's AI will tailor recommendations based on your mode.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MODES.map((m) => (
                      <div 
                        key={m.id}
                        onClick={() => handleModeChange(m.id)}
                        className={cn(
                          "cursor-pointer p-4 rounded-xl border transition-all duration-200",
                          mode === m.id 
                            ? "bg-slate-100 dark:bg-emerald-900/20 border-emerald-500/50 text-emerald-100" 
                            : "bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/10 border-slate-200 dark:border-emerald-900/30 text-slate-600 dark:text-slate-400 hover:border-emerald-700/50"
                        )}
                      >
                        <h3 className="font-medium text-sm mb-1">{m.title}</h3>
                        <p className="text-xs opacity-70">{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Targets Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Daily Calorie Target (kcal)</Label>
                    <Input 
                      type="number" 
                      value={calTarget} 
                      onChange={(e) => setCalTarget(e.target.value)} 
                      onBlur={handleSave}
                      className="bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border-slate-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Daily Protein Target (g)</Label>
                    <Input 
                      type="number" 
                      value={proteinTarget} 
                      onChange={(e) => setProteinTarget(e.target.value)} 
                      onBlur={handleSave}
                      className="bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border-slate-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Daily Steps Target</Label>
                    <Input 
                      type="number" 
                      value={stepsTarget} 
                      onChange={(e) => setStepsTarget(e.target.value)} 
                      onBlur={handleSave}
                      className="bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border-slate-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-300">Daily Sleep Target (hours)</Label>
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={sleepTarget} 
                      onChange={(e) => setSleepTarget(e.target.value)} 
                      onBlur={handleSave}
                      className="bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border-slate-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500/50" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Screen Time Limit (minutes)</Label>
                  <Input 
                    type="number" 
                    value={screenTimeTarget} 
                    onChange={(e) => setScreenTimeTarget(e.target.value)} 
                    onBlur={handleSave}
                    className="bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border-slate-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500/50" 
                  />
                </div>

              </div>
            </CardContent>
          </Card>

          {/* PERMISSIONS */}
          <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/10 backdrop-blur-xl shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Permissions</h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Manage device access for Lumen features</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/30 rounded-xl">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Motion Tracking</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Required for background step counting</p>
                  </div>
                  <Switch defaultChecked className="data-[state=checked]:bg-emerald-600" />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/30 rounded-xl">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Microphone</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Required for Voice Coach interactions</p>
                  </div>
                  <Switch defaultChecked className="data-[state=checked]:bg-emerald-600" />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/30 rounded-xl">
                  <div>
                    <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Notifications</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Required for smart nudges and reminders</p>
                  </div>
                  <Switch defaultChecked className="data-[state=checked]:bg-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* REMINDERS */}
          <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/10 backdrop-blur-xl shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Reminders</h2>
                </div>
                
                <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-50 dark:bg-emerald-950/30 border border-slate-200 dark:border-emerald-900/50 hover:bg-emerald-900/50 transition-colors px-3 py-1.5 rounded-full">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[420px] bg-slate-50 dark:bg-emerald-950 border-slate-200 dark:border-emerald-900/50 text-slate-900 dark:text-slate-100 rounded-3xl">
                    <DialogHeader>
                      <DialogTitle>Add Reminder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Input type="time" value={newReminderTime} onChange={e => setNewReminderTime(e.target.value)} className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800" />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input placeholder="e.g. Hydration check" value={newReminderTitle} onChange={e => setNewReminderTitle(e.target.value)} className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800" />
                      </div>
                      <button 
                        disabled={!newReminderTitle}
                        onClick={() => {
                          createReminder.mutate({ data: { title: newReminderTitle, time: newReminderTime, category: 'general', enabled: true, repeatDays: ["MON","TUE","WED","THU","FRI","SAT","SUN"], aiGenerated: false } }, {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
                              setNewReminderTitle("");
                              setIsReminderOpen(false);
                            }
                          });
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Save Reminder
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Smart nudges throughout your day</p>

              <div className="space-y-3">
                {isLoadingReminders ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin w-5 h-5 text-emerald-500" /></div>
                ) : reminders?.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-500 text-center py-4">No reminders active.</p>
                ) : (
                  reminders?.map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 border border-slate-200 dark:border-emerald-900/30 rounded-xl group">
                      <div className="flex items-start gap-4">
                        <Switch 
                          checked={reminder.enabled} 
                          onCheckedChange={(val) => {
                            updateReminder.mutate({ reminderId: reminder.id, data: { enabled: val } }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() })
                            });
                          }}
                          className="data-[state=checked]:bg-emerald-600 mt-1" 
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{reminder.time}</span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{reminder.title}</span>
                            {reminder.aiGenerated && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-750 dark:text-emerald-400 border-emerald-500/20 px-1.5 py-0">AI</Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-500 mt-0.5 tracking-wider">{reminder.repeatDays?.join(", ")}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          deleteReminder.mutate({ reminderId: reminder.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() })
                          });
                        }}
                        className="text-slate-500 dark:text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
        </div>
      </motion.div>
    </div>
  );
}
