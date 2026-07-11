import { useState } from "react";
import { GlassCard, MotionCard } from "@/components/ui/motion-card";
import { CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Brain, TrendingUp, Target, Activity, Calendar, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetIntelligenceReport, getGetIntelligenceReportQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

export default function Reports() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const queryClient = useQueryClient();

  const { data: report, isLoading, isFetching, refetch } = useGetIntelligenceReport(
    { period },
    { query: { queryKey: getGetIntelligenceReportQueryKey({ period }), enabled: true, staleTime: 0 } }
  );

  const handlePeriodChange = (newPeriod: "weekly" | "monthly") => {
    setPeriod(newPeriod);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Health Intelligence</h1>
          <p className="text-muted-foreground mt-1">Deep analysis of your long-term trends</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button 
            variant={period === "weekly" ? "outline" : "secondary"} 
            className="rounded-full"
            onClick={() => handlePeriodChange("weekly")}
          >
            Weekly
          </Button>
          <Button 
            variant={period === "monthly" ? "outline" : "secondary"} 
            className="rounded-full"
            onClick={() => handlePeriodChange("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {isLoading || isFetching ? (
        <motion.div variants={item} className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <Loader2 className="w-6 h-6 text-primary animate-spin absolute -bottom-1 -right-1" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg">Analyzing your health data...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Our AI is reviewing your {period === "weekly" ? "last 7 days" : "last 30 days"} of activity
            </p>
          </div>
        </motion.div>
      ) : report ? (
        <>
          {/* Synthesis Card */}
          <motion.div variants={item}>
            <GlassCard className="border-primary/20 bg-primary/5">
              <CardContent className="p-6 md:p-8">
                <div className="flex gap-4 items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xl mb-2">
                      {period === "weekly" ? "Weekly" : "Monthly"} Synthesis
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {report.synthesis}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                      <Target className="w-4 h-4 text-green-500" /> Consistency Score
                    </div>
                    <div className="text-2xl font-bold">{report.consistencyScore}</div>
                  </div>
                  <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" /> Avg Recovery
                    </div>
                    <div className="text-2xl font-bold">{report.avgRecovery}</div>
                  </div>
                  <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                    <div className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-500" /> Top Metric
                    </div>
                    <div className="text-2xl font-bold">{report.topMetric}</div>
                  </div>
                </div>
              </CardContent>
            </GlassCard>
          </motion.div>

          {/* Insights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div variants={item}>
              <MotionCard className="h-full">
                <CardContent className="p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Goal Achievement Probability</h4>
                    <p className="text-sm text-muted-foreground">{report.goalProbability}</p>
                  </div>
                </CardContent>
              </MotionCard>
            </motion.div>
            
            <motion.div variants={item}>
              <MotionCard className="h-full">
                <CardContent className="p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Recommended Adjustments</h4>
                    <p className="text-sm text-muted-foreground">{report.adjustments}</p>
                  </div>
                </CardContent>
              </MotionCard>
            </motion.div>
          </div>
        </>
      ) : (
        <motion.div variants={item} className="text-center py-16">
          <p className="text-muted-foreground">Unable to generate report. Please check your API key configuration.</p>
        </motion.div>
      )}
    </motion.div>
  );
}
