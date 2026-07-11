import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Trophy, Star, Zap, Shield, Target } from "lucide-react";

export default function BadgesPage() {
  const badges = [
    { name: "Early Bird", description: "Log 5 morning workouts before 8 AM.", icon: <Flame className="w-8 h-8 text-orange-500" />, unlocked: true },
    { name: "Consistency King", description: "Hit your daily goals for 30 consecutive days.", icon: <Trophy className="w-8 h-8 text-yellow-500" />, unlocked: true },
    { name: "Hydration Hero", description: "Drink 3 liters of water in a single day.", icon: <Zap className="w-8 h-8 text-blue-500" />, unlocked: true },
    { name: "Iron Will", description: "Complete a 90-minute high-intensity workout.", icon: <Shield className="w-8 h-8 text-slate-400" />, unlocked: false },
    { name: "Zen Master", description: "Meditate for 10 consecutive days.", icon: <Star className="w-8 h-8 text-slate-400" />, unlocked: false },
    { name: "Perfect Week", description: "Hit all targets for a full week.", icon: <Target className="w-8 h-8 text-slate-400" />, unlocked: false },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight mb-2">Achievements & Badges</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Celebrate your milestones and see what you can achieve next.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {badges.map((badge, index) => (
            <motion.div
              key={badge.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className={`h-full text-center flex flex-col items-center justify-center p-6 border-border/50 backdrop-blur-xl transition-all duration-300 ${badge.unlocked ? 'bg-card hover:scale-105 shadow-xl shadow-primary/5' : 'bg-card/30 grayscale opacity-70'}`}>
                <div className={`p-4 rounded-full mb-4 ${badge.unlocked ? 'bg-primary/10' : 'bg-muted'}`}>
                  {badge.icon}
                </div>
                <CardTitle className="text-lg mb-2">{badge.name}</CardTitle>
                <CardDescription className="text-xs">{badge.description}</CardDescription>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
