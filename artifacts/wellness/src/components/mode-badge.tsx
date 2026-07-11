import { Badge } from "@/components/ui/badge";

export function ModeBadge({ mode }: { mode: string }) {
  const modeLabels: Record<string, string> = {
    standard: "Standard",
    diabetes: "Diabetes",
    hypertension: "Heart Health",
    heart_health: "Heart Health",
    pregnancy: "Pregnancy",
    weight_loss: "Weight Loss",
  };

  const bgClasses: Record<string, string> = {
    standard: "bg-muted text-muted-foreground",
    diabetes: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    hypertension: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    heart_health: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    pregnancy: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    weight_loss: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  };

  if (mode === "standard" || !mode) return null;

  return (
    <Badge variant="outline" className={`${bgClasses[mode] || bgClasses.standard} border-none font-medium`}>
      {modeLabels[mode] || mode}
    </Badge>
  );
}
