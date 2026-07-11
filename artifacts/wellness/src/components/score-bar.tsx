import { Progress } from "@/components/ui/progress";

interface ScoreBarProps {
  score: number;
  max?: number;
  className?: string;
  colorClass?: string;
}

export function ScoreBar({ score, max = 10, className, colorClass = "bg-primary" }: ScoreBarProps) {
  const percentage = Math.min(100, Math.max(0, ((score ?? 0) / (max || 1)) * 100)) || 0;
  
  return (
    <div className={`h-1.5 w-full bg-muted rounded-full overflow-hidden ${className}`}>
      <div 
        className={`h-full rounded-full ${colorClass} transition-all duration-500 ease-out`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
