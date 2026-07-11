import { useGenerateWeeklyPlan, useGenerateMonthlyPlan, getGenerateWeeklyPlanQueryKey, getGenerateMonthlyPlanQueryKey } from "@workspace/api-client-react";
import { LoadingState } from "@/components/loading-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar as CalendarIcon, CheckCircle2, Target } from "lucide-react";
import { ModeBadge } from "@/components/mode-badge";
import { useQueryClient } from "@tanstack/react-query";

export default function Planner() {
  const qc = useQueryClient();
  const { data: weeklyPlan, isLoading: isLoadingWeekly } = useGenerateWeeklyPlan();
  const { data: monthlyPlan, isLoading: isLoadingMonthly } = useGenerateMonthlyPlan();

  const handleRefine = () => {
    qc.invalidateQueries({ queryKey: getGenerateWeeklyPlanQueryKey() });
    qc.invalidateQueries({ queryKey: getGenerateMonthlyPlanQueryKey() });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Planner</h1>
          <p className="text-muted-foreground">AI-tailored goals and actions</p>
        </div>
        <Button variant="outline" className="rounded-full shadow-sm" onClick={handleRefine}>
          <Sparkles className="w-4 h-4 mr-2 text-primary" /> Refine with AI
        </Button>
      </div>

      <Tabs defaultValue="weekly" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="weekly">Weekly Plan</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Overview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="weekly" className="mt-6 space-y-6">
          {isLoadingWeekly ? <LoadingState /> : weeklyPlan && (
            <>
              <Card className="bg-primary/5 border-none shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-lg">This Week's Focus</h3>
                    </div>
                    <ModeBadge mode={weeklyPlan.modeContext || "standard"} />
                  </div>
                  <p className="text-lg font-medium text-foreground/80">{weeklyPlan.theme}</p>
                </CardContent>
              </Card>

              <div className="space-y-4">
                {weeklyPlan.days.map((day: any, i: any) => (
                  <Card key={i} className="shadow-sm">
                    <CardHeader className="pb-3 border-b">
                      <CardTitle className="text-base flex items-center gap-2">
                        {day.weekday}
                        <span className="text-sm font-normal text-muted-foreground">{day.date}</span>
                      </CardTitle>
                      <CardDescription>{day.focus}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      {(Array.isArray(day.actions) ? day.actions : []).map((action: any, j: any) => (
                        <div key={j} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">{action.title}</p>
                            <p className="text-xs text-muted-foreground">{action.detail}</p>
                            {action.targetValue && (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-secondary/10 text-secondary-foreground text-[10px] font-medium">
                                Target: {action.targetValue}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="mt-6 space-y-6">
          {isLoadingMonthly ? <LoadingState /> : monthlyPlan && (
            <>
              <Card className="bg-secondary/5 border-none shadow-sm">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-secondary" />
                      <h3 className="font-semibold text-lg">{monthlyPlan.month} Overview</h3>
                    </div>
                    <ModeBadge mode={monthlyPlan.modeContext || "standard"} />
                  </div>
                  <p className="text-foreground/80 leading-relaxed">{monthlyPlan.narrative}</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthlyPlan.weeks.map((week: any, i: any) => (
                  <Card key={i} className="shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{week.weekLabel}</CardTitle>
                      <CardDescription className="text-primary font-medium">{week.theme}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {(Array.isArray(week.goals) ? week.goals : []).map((goal: any, j: any) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0 mt-1.5" />
                            <span className="text-muted-foreground">{goal}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
