import { useState } from "react";
import { useListSleep, useCreateSleep, useDeleteSleep, getListSleepQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/loading-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Moon, Plus, Trash2, Clock, BedDouble, Sunrise } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const qualityOptions = [
  { id: "excellent", label: "Excellent", color: "text-emerald-750 dark:text-emerald-400 border-emerald-500 bg-emerald-500/10" },
  { id: "good", label: "Good", color: "text-green-400 border-green-500 bg-green-500/10" },
  { id: "fair", label: "Fair", color: "text-yellow-400 border-yellow-500 bg-yellow-500/10" },
  { id: "poor", label: "Poor", color: "text-red-400 border-red-500 bg-red-500/10" },
];

export default function SleepPage() {
  const { data: sleepRecords, isLoading } = useListSleep();
  const createSleep = useCreateSleep();
  const deleteSleep = useDeleteSleep();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState("7.5");
  const [quality, setQuality] = useState("good");
  const [bedtime, setBedtime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("06:30");
  const [deepSleep, setDeepSleep] = useState("1.5");

  const handleSubmit = async () => {
    try {
      await createSleep.mutateAsync({
        data: {
          date: new Date().toISOString().split("T")[0],
          durationHours: parseFloat(duration) || 0,
          quality,
          bedtime,
          wakeTime,
          deepSleepHours: parseFloat(deepSleep) || 0,
        },
      });
      qc.invalidateQueries({ queryKey: getListSleepQueryKey() });
      toast({ title: "Sleep logged", description: `${duration} hours of ${quality} sleep recorded.` });
      setOpen(false);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSleep.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListSleepQueryKey() });
      toast({ title: "Entry deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (isLoading) return <LoadingState title="Loading Sleep Records" />;

  const chartData = sleepRecords
    ? [...sleepRecords].reverse().slice(-14).map((s: any) => ({
        date: s.date,
        hours: s.durationHours,
      }))
    : [];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Sleep</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Monitor rest and recovery</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-5 shadow-lg shadow-emerald-500/20">
                <Plus className="w-4 h-4 mr-2" /> Log Sleep
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] bg-slate-50 dark:bg-emerald-950 border-slate-200 dark:border-emerald-900/50 text-slate-900 dark:text-slate-100 rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Moon className="w-5 h-5 text-emerald-750 dark:text-emerald-400" /> Log Sleep
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-4">
                {/* Duration */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Clock className="w-4 h-4 text-emerald-750 dark:text-emerald-400" /> Duration (hours)
                  </Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800 text-3xl font-bold text-center h-16"
                  />
                </div>

                {/* Quality */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Quality</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {qualityOptions.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => setQuality(q.id)}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all",
                          quality === q.id ? q.color : "border-transparent bg-slate-100 dark:bg-emerald-900/20 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <BedDouble className="w-4 h-4 text-indigo-400" /> Bedtime
                    </Label>
                    <Input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Sunrise className="w-4 h-4 text-amber-400" /> Wake Time
                    </Label>
                    <Input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800" />
                  </div>
                </div>

                {/* Deep Sleep */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Deep Sleep (hours)</Label>
                  <Input type="number" step="0.1" value={deepSleep} onChange={(e) => setDeepSleep(e.target.value)} className="bg-slate-100 dark:bg-emerald-900/20 border-slate-200 dark:border-emerald-800" />
                </div>

                <Button onClick={handleSubmit} disabled={createSleep.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-semibold">
                  {createSleep.isPending ? "Saving..." : "Save Sleep Log"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Trend Chart */}
        {chartData.length > 0 && (
          <Card className="mb-8 border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 backdrop-blur-xl overflow-hidden">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-4">
                <Moon className="w-4 h-4 text-emerald-750 dark:text-emerald-400" /> 14-Day Sleep Trend
              </h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sleepGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d4a574" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#d4a574" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={(val) => (val ? format(new Date(val), "EEE, MMM d") : "")} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={[0, 12]} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", background: "rgba(0,0,0,0.85)", color: "#fff" }} labelFormatter={(val) => (val ? format(new Date(val), "PPP") : "")} />
                    <Area type="monotone" dataKey="hours" stroke="#d4a574" strokeWidth={2.5} fillOpacity={1} fill="url(#sleepGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Entries */}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Recent Entries</h3>
        <div className="space-y-3">
          {sleepRecords && sleepRecords.length > 0 ? (
            sleepRecords.map((sleep: any) => (
              <motion.div key={sleep.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group">
                <Card className="border-slate-200 dark:border-emerald-900/30 bg-slate-50 dark:bg-slate-50 dark:bg-emerald-950/20 hover:bg-slate-50 dark:bg-emerald-950/40 transition-all">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-900/30 flex items-center justify-center">
                        <Moon className="w-5 h-5 text-emerald-750 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {sleep.date ? format(new Date(sleep.date), "EEE, MMM d") : "Unknown"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-slate-600 dark:text-slate-400">{sleep.durationHours} hrs</span>
                          <Badge variant="outline" className={cn(
                            "text-[10px] px-1.5 py-0",
                            sleep.quality === "excellent" ? "text-emerald-750 dark:text-emerald-400 border-emerald-500/30" :
                            sleep.quality === "good" ? "text-green-400 border-green-500/30" :
                            sleep.quality === "fair" ? "text-yellow-400 border-yellow-500/30" :
                            "text-red-400 border-red-500/30"
                          )}>
                            {sleep.quality}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(sleep.id)}
                      className="text-slate-500 dark:text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="py-12 text-center border rounded-xl border-dashed border-slate-200 dark:border-emerald-900/30">
              <Moon className="w-8 h-8 text-slate-500 dark:text-slate-500 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No sleep records yet. Tap "+ Log Sleep" to start tracking.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
