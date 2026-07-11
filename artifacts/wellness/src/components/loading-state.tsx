import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ui/motion-card";
import { CardContent, CardHeader } from "@/components/ui/card";
import { motion } from "framer-motion";

export function LoadingState({ title }: { title?: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
      <GlassCard className="w-full">
        {title && (
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4 rounded-full bg-primary/20" />
              <Skeleton className="h-6 w-1/3 bg-primary/10" />
            </div>
          </CardHeader>
        )}
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </CardContent>
      </GlassCard>
    </motion.div>
  );
}
