import { useGetMyProfile, useGetTodayDashboard, useGetStreaks, useGetScoreTrend, getGetScoreTrendQueryKey } from "@workspace/api-client-react";
import { ScoreRing } from "@/components/score-ring";
import { ScoreBar } from "@/components/score-bar";
import { LoadingState } from "@/components/loading-state";
import { formatNumber, scoreColor, scoreBgColor } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SleepLogForm } from "@/components/logging/SleepLogForm";
import { MotionCard, GlassCard } from "@/components/ui/motion-card";
import { motion } from "framer-motion";
import { Flame, Droplet, Brain, Activity, MoonIcon, Utensils, MonitorSmartphone, ArrowRight, ActivitySquare } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LoggingDashboardWidget } from "@/components/logging";
import { TimelineWidget } from "@/components/dashboard/TimelineWidget";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export default function Dashboard() {
  const { data: profile, isLoading: isProfileLoading } = useGetMyProfile();
  const { data: dashboard, isLoading: isDashboardLoading } = useGetTodayDashboard();
  const { data: streaks, isLoading: isStreaksLoading } = useGetStreaks();
  const { data: trendData } = useGetScoreTrend({ range: "week" }, { query: { enabled: true, queryKey: getGetScoreTrendQueryKey({ range: "week" }) } });
  
  const isDiabetes = profile?.mode === "diabetes";
  const { data: glucoseData } = { data: null as any };

  if (isProfileLoading || isDashboardLoading || isStreaksLoading) {
    return <LoadingState title="Loading dashboard..." />;
  }

  if (!profile || !dashboard) return null;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="md:col-span-2 overflow-hidden bg-gradient-to-br from-primary/10 to-transparent border-none">
          <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-3xl font-bold tracking-tight mb-2">Good morning, {profile.name}</h2>
              <p className="text-muted-foreground mb-6">Today is looking like a {dashboard.moodLabel?.toLowerCase() || 'great'} day.</p>
              
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <Link href="/nutrition">
                  <Button variant="secondary" className="rounded-full shadow-sm hover-elevate-2 transition-all" size="sm">
                    <Utensils className="w-4 h-4 mr-2" /> Log Meal
                  </Button>
                </Link>
                <Link href="/activity">
                  <Button variant="secondary" className="rounded-full shadow-sm hover-elevate-2 transition-all" size="sm">
                    <Activity className="w-4 h-4 mr-2" /> Track Activity
                  </Button>
                </Link>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center">
              <ScoreRing score={dashboard.overallScore} size={140} strokeWidth={14} className="mb-2 transition-transform hover:scale-105 duration-300" />
            </div>
          </CardContent>
        </GlassCard>

        {/* Top Recommendation */}
        {dashboard.topRecommendation && (
          <MotionCard className="bg-secondary/10 border-none flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <CardContent className="p-6 relative z-10">
              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary mb-4 shadow-sm">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{dashboard.topRecommendation.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{dashboard.topRecommendation.body}</p>
              {dashboard.topRecommendation.action && (
                <Button variant="outline" className="w-full text-secondary hover:text-secondary-foreground border-secondary/20 hover:bg-secondary transition-colors">
                  {dashboard.topRecommendation.action}
                </Button>
              )}
            </CardContent>
          </MotionCard>
        )}
      </motion.div>



      {/* Health Logging Widget */}
      <motion.div variants={item}>
        <LoggingDashboardWidget />
      </motion.div>

      {/* Unified Timeline Feed */}
      <motion.div variants={item}>
        <TimelineWidget />
      </motion.div>

      {/* Categories */}
      {Array.isArray(dashboard.scores) && dashboard.scores.length > 0 && (
        <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Array.isArray(dashboard.scores) ? dashboard.scores : []).map((s) => {
            const cardContent = (
              <MotionCard key={s.category} className={s.category === 'sleep' ? "cursor-pointer hover:border-primary/50 transition-colors" : ""}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium capitalize text-sm">{s.category}</span>
                    <span className={`font-bold ${scoreColor(s.category)}`}>{s.score?.toFixed(1) ?? '—'}</span>
                  </div>
                  <ScoreBar score={s.score ?? 0} colorClass={scoreBgColor(s.category)} className="mb-2 h-2" />
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </MotionCard>
            );

            if (s.category === 'sleep') {
              return (
                <Dialog key={s.category}>
                  <DialogTrigger asChild>
                    {cardContent}
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-950 rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-slate-100 dark:to-slate-400">
                        Log Sleep
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      <SleepLogForm onCancel={() => document.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape'}))} onSubmit={() => document.dispatchEvent(new KeyboardEvent('keydown', {'key': 'Escape'}))} />
                    </div>
                  </DialogContent>
                </Dialog>
              );
            }
            return cardContent;
          })}
        </motion.div>
      )}

      {/* Streaks */}
      {Array.isArray(streaks) && streaks.length > 0 && (
        <motion.div variants={item}>
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" /> Active Streaks
          </h3>
          <div className="flex overflow-x-auto pb-4 gap-4 snap-x hide-scrollbar">
            {streaks.map((streak) => (
              <MotionCard key={streak.id} className="shrink-0 w-64 snap-start border-orange-100 dark:border-orange-900/30 bg-orange-50/50 dark:bg-orange-900/10">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg shadow-sm">
                    {streak.days}
                  </div>
                  <div>
                    <div className="font-medium capitalize text-sm">{streak.category}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{streak.message}</div>
                  </div>
                </CardContent>
              </MotionCard>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trend Chart */}
        {Array.isArray(trendData) && trendData.length > 0 && (
          <GlassCard>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-6">7-Day Score Trend</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 10]} tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.8)', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }} />
                    <Area type="monotone" dataKey="overall" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </GlassCard>
        )}

        {/* Macros & Activity summary */}
        <div className="space-y-4">
          {isDiabetes && glucoseData?.summary && (
            <Link href="/glucose" className="block">
              <MotionCard className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center shadow-sm">
                      <ActivitySquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">Glucose (14d Avg)</div>
                      <div className="text-2xl font-bold text-primary">{Math.round(glucoseData.summary.averageMgDl)} <span className="text-sm font-normal text-muted-foreground">mg/dL</span></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">TIR</div>
                    <div className="font-bold">{Math.round(glucoseData.summary.timeInRangePct)}%</div>
                  </div>
                </CardContent>
              </MotionCard>
            </Link>
          )}

          <MotionCard>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center shadow-sm">
                  <Droplet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-medium text-sm">Hydration</div>
                  <div className="text-2xl font-bold">{dashboard.waterCups ?? 0} <span className="text-sm font-normal text-muted-foreground">cups</span></div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </MotionCard>
          
          <MotionCard>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="font-medium text-sm">Calories</div>
                <div className="text-sm font-bold">{formatNumber(dashboard.caloriesConsumed ?? 0)} / {formatNumber(dashboard.caloriesTarget ?? 2000)} kcal</div>
              </div>
              <ScoreBar score={dashboard.caloriesConsumed ?? 0} max={dashboard.caloriesTarget ?? 2000} className="h-2 mb-4" colorClass="bg-blue-500" />
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Protein</div>
                  <div className="text-sm font-semibold">{dashboard.proteinGrams ?? 0}g</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Carbs</div>
                  <div className="text-sm font-semibold">{dashboard.carbsGrams ?? 0}g</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Fat</div>
                  <div className="text-sm font-semibold">{dashboard.fatGrams ?? 0}g</div>
                </div>
              </div>
            </CardContent>
          </MotionCard>
        </div>
      </motion.div>
    </motion.div>
  );
}
