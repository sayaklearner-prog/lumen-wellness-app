import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Apple, Watch, Heart } from "lucide-react";

export default function ConnectionsPage() {
  const providers = [
    { name: "Apple Health", icon: <Apple className="w-6 h-6" />, connected: true },
    { name: "Oura Ring", icon: <div className="w-6 h-6 rounded-full border-2 border-current" />, connected: false },
    { name: "Garmin", icon: <Watch className="w-6 h-6" />, connected: false },
    { name: "Fitbit", icon: <Activity className="w-6 h-6" />, connected: true },
    { name: "Whoop", icon: <Heart className="w-6 h-6" />, connected: false },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight mb-2">Health Connections</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Sync your wearable devices and health apps to centralize your wellness data.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider, index) => (
            <motion.div
              key={provider.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className={`h-full border-border/50 backdrop-blur-xl transition-all duration-300 ${provider.connected ? 'bg-primary/5' : 'bg-card/50 hover:bg-card/80'}`}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center text-xl">
                    <span className="flex items-center gap-3">
                      {provider.icon}
                      {provider.name}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    {provider.connected ? (
                      <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">Connected</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Not Connected</Badge>
                    )}
                    <Button variant={provider.connected ? "outline" : "default"} size="sm">
                      {provider.connected ? "Manage" : "Connect"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
