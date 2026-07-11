import React from 'react';
import { useGetTimeline } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplet, Activity, Smile, Pill, ArrowRight, Plus, Utensils } from 'lucide-react';
import { LoggingModal } from './LoggingModal';

export function LoggingDashboardWidget() {
  const { data: timelineEvents, isLoading } = useGetTimeline();

  const iconMap: Record<string, React.ElementType> = {
    meal: Utensils,
    workout: Activity,
    hydration: Droplet,
    mood: Smile,
    vitals: Activity,
    medication: Pill,
    sleep: Activity,
  };

  const recentLogs = timelineEvents ? timelineEvents.slice(0, 3).map(event => {
    const IconComponent = iconMap[event.type] || Activity;
    // Map basic colors based on type
    let color = 'text-blue-500';
    let bg = 'bg-blue-100 dark:bg-blue-900/30';
    if (event.type === 'workout') { color = 'text-red-500'; bg = 'bg-red-100 dark:bg-red-900/30'; }
    if (event.type === 'mood') { color = 'text-yellow-500'; bg = 'bg-yellow-100 dark:bg-yellow-900/30'; }
    if (event.type === 'medication') { color = 'text-purple-500'; bg = 'bg-purple-100 dark:bg-purple-900/30'; }

    return {
      id: event.id,
      type: event.type,
      title: event.title,
      time: format(new Date(event.timestamp), "h:mm a"),
      icon: IconComponent,
      color,
      bg
    };
  }) : [];

  return (
    <Card className="col-span-full md:col-span-2 lg:col-span-1 shadow-sm hover:shadow-md transition-shadow duration-300 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-slate-50/50 dark:bg-slate-900/20">
        <div className="space-y-1">
          <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-slate-100 dark:to-slate-400">
            Health Log
          </CardTitle>
          <CardDescription className="font-medium">Your recent entries</CardDescription>
        </div>
        <LoggingModal>
          <Button size="icon" className="h-9 w-9 rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-md group-hover:scale-110 transition-transform duration-300">
            <Plus className="h-4 w-4" />
          </Button>
        </LoggingModal>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-4"><div className="animate-spin h-5 w-5 border-b-2 border-slate-900 dark:border-white rounded-full"></div></div>
          ) : recentLogs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No recent logs.</p>
          ) : (
            recentLogs.map((log) => (
              <div key={log.id} className="flex items-center space-x-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                <div className={`p-2.5 rounded-xl ${log.bg} ${log.color} shadow-sm`}>
                  <log.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-none">{log.title}</p>
                  <p className="text-xs font-medium text-slate-500">{log.time}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
          
          <div className="pt-2">
            <Button variant="outline" className="w-full rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
              View All History
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
