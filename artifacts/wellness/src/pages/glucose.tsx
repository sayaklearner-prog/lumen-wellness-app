import { useListGlucose } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/loading-state";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";

export default function GlucosePage() {
  const { data: glucoseReadings, isLoading } = useListGlucose();

  if (isLoading) {
    return <LoadingState title="Loading Glucose Readings" />;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight mb-2">Glucose Monitoring</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Keep track of your blood glucose levels for optimal metabolic health.
        </p>

        {glucoseReadings && glucoseReadings.length > 0 && (
          <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Glucose Trend</CardTitle>
              <CardDescription>Recent blood glucose readings (mg/dL)</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={glucoseReadings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="loggedAt" 
                    tickFormatter={(val) => val ? format(new Date(val), "MMM d") : ""} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 10', 'dataMax + 10']}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                    labelFormatter={(val) => val ? format(new Date(val), "PPP p") : ""}
                  />
                  <Line type="monotone" dataKey="readingMgdl" stroke="hsl(var(--destructive))" strokeWidth={3} dot={{ fill: "hsl(var(--destructive))", strokeWidth: 2, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {glucoseReadings && glucoseReadings.length > 0 ? (
            glucoseReadings.map((reading, index) => (
              <motion.div
                key={reading.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full border-border/50 bg-card/50 backdrop-blur-xl hover:bg-card/80 transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center text-lg">
                      <span className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-red-500" />
                        {reading.readingMgdl} mg/dL
                      </span>
                    </CardTitle>
                    <CardDescription>
                      {reading.loggedAt ? format(new Date(reading.loggedAt), "PPP p") : "Unknown date"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Context</span>
                      <span className="font-medium capitalize">{reading.contextType ?? "General"}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border rounded-xl border-dashed">
              <p className="text-muted-foreground">No glucose readings logged yet.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
