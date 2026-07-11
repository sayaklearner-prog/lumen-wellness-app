import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetMyProfile, useUpdateMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, Sparkles, User, Apple, Flame, Target, Trophy, Clock, Moon, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const modes = [
  { id: "standard", title: "Standard Health", icon: "🌱", desc: "General wellbeing & energy optimization." },
  { id: "diabetes", title: "Diabetes Care", icon: "🩸", desc: "Strict glucose targets and carb limits." },
  { id: "heart_health", title: "Heart Health", icon: "❤️", desc: "Cardiovascular endurance and active focus." },
  { id: "weight_loss", title: "Weight Management", icon: "⚖️", desc: "Sustainable calorie deficits & tracking." },
  { id: "pregnancy", title: "Pregnancy Focus", icon: "🤰", desc: "Enhanced prenatal nutrition & gentle recovery." },
];

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function OnboardingModal({ open, onOpenChange, onComplete }: OnboardingModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();

  const [step, setStep] = useState(1);

  // Profile data state
  const [name, setName] = useState(profile?.name || "");
  const [mode, setMode] = useState(profile?.mode || "standard");
  const [calories, setCalories] = useState(profile?.dailyCalorieTarget?.toString() || "2100");
  const [protein, setProtein] = useState(profile?.dailyProteinTarget?.toString() || "110");
  const [steps, setSteps] = useState(profile?.dailyStepsTarget?.toString() || "9000");
  const [sleep, setSleep] = useState(profile?.dailySleepTargetHours?.toString() || "8.0");
  const [screenTime, setScreenTime] = useState(profile?.dailyScreenTimeLimitMinutes?.toString() || "180");

  const handleNext = () => {
    if (step === 1 && !name) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    try {
      await updateProfile.mutateAsync({
        data: {
          name,
          mode,
          dailyCalorieTarget: parseInt(calories) || 2100,
          dailyProteinTarget: parseInt(protein) || 110,
          dailyStepsTarget: parseInt(steps) || 9000,
          dailySleepTargetHours: parseFloat(sleep) || 8.0,
          dailyScreenTimeLimitMinutes: parseInt(screenTime) || 180,
          onboardingComplete: true
        }
      });
      
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      localStorage.setItem("lumen_authenticated", "true");
      toast({ title: "Welcome to Lumen OS!", description: "Your bio-profiles have been successfully initialized." });
      onComplete();
    } catch {
      toast({ title: "Failed to initialize profile", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] bg-slate-900 border-slate-800 text-slate-100 rounded-3xl p-8 overflow-hidden backdrop-blur-2xl">
        <DialogHeader className="mb-6">
          <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
            <span>MeshMind Lumen OS</span>
            <span>Step {step} of 4</span>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-full mb-4">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }} />
          </div>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <DialogTitle className="text-2xl font-black text-slate-100 flex items-center gap-2">
                  <User className="w-6 h-6 text-emerald-400" /> Set Up Your Profile
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  Tell us who you are and select your active health mode.
                </DialogDescription>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Your Full Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Alexander Mercer"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-200 h-12"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-slate-300">Target Health Focus</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "w-full p-3 rounded-2xl border text-left flex items-start gap-3 transition-all",
                        mode === m.id
                          ? "bg-emerald-950/20 border-emerald-500/50 text-slate-100"
                          : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                      )}
                    >
                      <span className="text-2xl mt-0.5">{m.icon}</span>
                      <div>
                        <div className="font-bold text-sm text-slate-200">{m.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <DialogTitle className="text-2xl font-black text-slate-100 flex items-center gap-2">
                  <Apple className="w-6 h-6 text-emerald-400" /> Nutritional Baseline
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  Define your daily targets for protein and calories.
                </DialogDescription>
              </div>

              {/* Calories */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-2xl">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" /> Daily Calories Target
                  </Label>
                  <span className="text-xl font-bold text-slate-100">{calories} kcal</span>
                </div>
                <input
                  type="range"
                  min="1200"
                  max="4000"
                  step="50"
                  value={calories}
                  onChange={e => setCalories(e.target.value)}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Protein */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-2xl">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Daily Protein Target
                  </Label>
                  <span className="text-xl font-bold text-slate-100">{protein}g</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="250"
                  step="5"
                  value={protein}
                  onChange={e => setProtein(e.target.value)}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <DialogTitle className="text-2xl font-black text-slate-100 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-emerald-400" /> Lifestyle Targets
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  Establish daily baselines for steps, rest, and device limits.
                </DialogDescription>
              </div>

              {/* Steps */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-2xl">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Daily Steps Target
                  </Label>
                  <span className="text-xl font-bold text-slate-100">{parseInt(steps).toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="3000"
                  max="20000"
                  step="500"
                  value={steps}
                  onChange={e => setSteps(e.target.value)}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Sleep */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-2xl">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Moon className="w-4 h-4 text-amber-400" /> Daily Sleep Target
                  </Label>
                  <span className="text-xl font-bold text-slate-100">{sleep} hrs</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="11"
                  step="0.5"
                  value={sleep}
                  onChange={e => setSleep(e.target.value)}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Screen Time */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-2xl">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" /> Screen Time Limit
                  </Label>
                  <span className="text-xl font-bold text-slate-100">{screenTime} min</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="480"
                  step="15"
                  value={screenTime}
                  onChange={e => setScreenTime(e.target.value)}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-center py-4"
            >
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
              </div>

              <div>
                <DialogTitle className="text-2xl font-black text-slate-100">
                  Profile Summary Review
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
                  Ready to deploy your health parameters to Lumen Health OS.
                </DialogDescription>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left text-xs bg-slate-950/40 border border-slate-800 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-500 block">Full Name</span>
                  <span className="font-bold text-slate-200 text-sm">{name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Health Focus Mode</span>
                  <span className="font-bold text-slate-200 text-sm capitalize">{mode.replace("_", " ")}</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block">Calorie Target</span>
                  <span className="font-bold text-emerald-400">{calories} kcal</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block">Protein Target</span>
                  <span className="font-bold text-emerald-400">{protein}g</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block">Daily Steps</span>
                  <span className="font-bold text-indigo-400">{parseInt(steps).toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-500 block">Daily Sleep</span>
                  <span className="font-bold text-amber-400">{sleep} hrs</span>
                </div>
              </div>

              <div className="flex gap-2 items-center justify-center text-xs text-slate-500">
                <Shield className="w-4 h-4 text-emerald-500" /> All parameters stored securely on-device.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons Row */}
        <div className="flex justify-between items-center gap-4 mt-8 pt-4 border-t border-slate-800">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={handleBack}
              className="border-slate-800 text-slate-400 hover:bg-slate-900"
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              onClick={handleNext}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 rounded-full"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={updateProfile.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 rounded-full font-bold shadow-lg shadow-emerald-500/20"
            >
              {updateProfile.isPending ? "Deploying..." : "Launch Dashboard"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
