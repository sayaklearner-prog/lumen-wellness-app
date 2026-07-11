import { useState } from "react";
import { useListScreentime, useCreateScreentime, useDeleteScreentime, getListScreentimeQueryKey } from "@workspace/api-client-react";
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
import { MonitorSmartphone, Plus, Trash2, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const categoryOptions = [
  { id: "social", label: "Social", color: "text-blue-400 border-blue-500 bg-blue-500/10" },
  { id: "entertainment", label: "Entertainment", color: "text-purple-400 border-purple-500 bg-purple-500/10" },
  { id: "productivity", label: "Productivity", color: "text-emerald-750 dark:text-emerald-400 border-emerald-500 bg-emerald-500/10" },
  { id: "gaming", label: "Gaming", color: "text-red-400 border-red-500 bg-red-500/10" },
  { id: "other", label: "Other", color: "text-slate-600 dark:text-slate-400 border-slate-500 bg-slate-500/10" },
];

export default function ScreenTimePage() {
  const { data: screenTime, isLoading } = useListScreentime();
  const createScreentime = useCreateScreentime();
  const deleteScreentime = useDeleteScreentime();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("2");
  const [minutes, setMinutes] = useState("30");
  const [category, setCategory] = useState("social");

  const handleSubmit = async () => {
    try {
      const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60;
      const now = new Date();
      const startedAt = new Date(now.getTime() - totalSeconds * 1000);
      await createScreentime.mutateAsync({
        data: {
          category,
          durationSeconds: totalSeconds,
          startedAt: startedAt.toISOString(),
          endedAt: now.toISOString(),
        },
      });
      qc.invalidateQueries({ queryKey: getListScreentimeQueryKey() });
      toast({ title: "Screen time logged", description: `${hours}h ${minutes}m of ${category} recorded.` });
      setOpen(false);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteScreentime.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListScreentimeQueryKey() });
      toast({ title: "Entry deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (isLoading) return <LoadingState title="Loading Screen Time" />;

  const chartData = screenTime
    ? [...screenTime].reverse().slice(-14).map((s: any) => ({
        date: s.startedAt || s.endedAt,
        mins: Math.round((s.durationSeconds || 0) / 60),
      }))
    : [];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Screen Time</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Track your digital wellness</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-5 shadow-lg shadow-indigo-500/20">
                <Plus className="w-4 h-4 mr-2" /> Log Screen Time
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <MonitorSmartphone className="w-5 h-5 text-indigo-400" /> Log Screen Time
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-4">
                {/* Duration */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Clock className="w-4 h-4 text-indigo-400" /> Duration
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-3xl font-bold text-center h-16 pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-500 font-medium">hrs</span>
                      </div>
                    </div>
                    <div>
                      <div className="relative">
                        <Input
                          type="number"
                          value={minutes}
                          onChange={(e) => setMinutes(e.target.value)}
                          className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-3xl font-bold text-center h-16 pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-500 font-medium">min</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">Category</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {categoryOptions.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all",
                          category === c.id ? c.color : "border-transparent bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSubmit} disabled={createScreentime.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-12 text-base font-semibold">
                  {createScreentime.isPending ? "Saving..." : "Save Screen Time"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Trend Chart */}
        {chartData.length > 0 && (
          <Card className="mb-8 border-slate-200 dark:border-indigo-900/30 bg-slate-50 dark:bg-indigo-950/20 backdrop-blur-xl overflow-hidden">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-4">
                <MonitorSmartphone className="w-4 h-4 text-indigo-400" /> 14-Day Screen Time Trend
              </h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="screenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={(val) => (val ? format(new Date(val), "EEE, MMM d") : "")} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", background: "rgba(0,0,0,0.85)", color: "#fff" }} labelFormatter={(val) => (val ? format(new Date(val), "PPP") : "")} formatter={(val: any) => [`${val} min`, "Duration"]} />
                    <Area type="monotone" dataKey="mins" stroke="#818cf8" strokeWidth={2.5} fillOpacity={1} fill="url(#screenGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Entries */}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Recent Entries</h3>
        <div className="space-y-3">
          {screenTime && screenTime.length > 0 ? (
            screenTime.map((record: any) => {
              const durationMins = Math.round((record.durationSeconds || 0) / 60);
              const h = Math.floor(durationMins / 60);
              const m = durationMins % 60;
              return (
                <motion.div key={record.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group">
                  <Card className="border-slate-200 dark:border-indigo-900/30 bg-slate-50 dark:bg-indigo-950/20 hover:bg-indigo-950/40 transition-all">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-900/30 flex items-center justify-center">
                          <MonitorSmartphone className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {record.endedAt ? format(new Date(record.endedAt), "EEE, MMM d") : "Unknown"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-slate-600 dark:text-slate-400">{h}h {m}m</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-indigo-400 border-indigo-500/30 capitalize">
                              {record.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-slate-500 dark:text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <div className="py-12 text-center border rounded-xl border-dashed border-slate-200 dark:border-indigo-900/30">
              <MonitorSmartphone className="w-8 h-8 text-slate-500 dark:text-slate-500 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No screen time logged yet. Tap "+ Log Screen Time" to start tracking.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
