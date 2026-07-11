import { useGetTimeline, useGetTimelineSummary } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Droplet, Utensils, Activity, Smile, Heart, Pill, Moon, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";

const iconMap: Record<string, React.ReactNode> = {
  meal: <Utensils className="h-4 w-4 text-orange-500" />,
  workout: <Activity className="h-4 w-4 text-red-500" />,
  hydration: <Droplet className="h-4 w-4 text-blue-500" />,
  mood: <Smile className="h-4 w-4 text-yellow-500" />,
  vitals: <Heart className="h-4 w-4 text-pink-500" />,
  medication: <Pill className="h-4 w-4 text-purple-500" />,
  sleep: <Moon className="h-4 w-4 text-indigo-500" />,
};

export function TimelineWidget() {
  const { data: timelineEvents, isLoading, isError } = useGetTimeline();
  const { data: summaryData, isLoading: isSummaryLoading } = useGetTimelineSummary();

  if (isLoading) {
    return (
      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle>Today's Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle>Today's Timeline</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p>Failed to load timeline</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[400px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Today's Timeline</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
        {/* AI Summary Banner */}
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="mt-1 bg-primary/10 p-2 rounded-full">
              <Smile className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1">AI Daily Summary</h4>
              {isSummaryLoading ? (
                <p className="text-sm text-muted-foreground animate-pulse">Generating summary...</p>
              ) : (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summaryData?.summary || "Log more events to get a summary of your day."}
                </p>
              )}
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6 pb-6">
          {!timelineEvents || timelineEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm">
              <p>No activity logged today.</p>
              <p className="mt-1">Log your first meal or workout!</p>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {timelineEvents.map((event, index) => (
                <div key={event.id} className="relative pl-6">
                  {/* Timeline line connecting items */}
                  {index !== timelineEvents.length - 1 && (
                    <div className="absolute left-3 top-8 bottom-[-24px] w-px bg-border"></div>
                  )}
                  
                  {/* Icon Node */}
                  <div className="absolute left-0 top-1 rounded-full bg-background border p-1.5 shadow-sm">
                    {iconMap[event.type] || <Activity className="h-3 w-3" />}
                  </div>
                  
                  {/* Content */}
                  <div className="pl-4 pb-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{event.title}</h4>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), "h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
