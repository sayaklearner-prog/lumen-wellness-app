import { Cell, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

interface ScoreRingProps {
  score: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}

export function ScoreRing({ score, max = 10, size = 120, strokeWidth = 12, color = "hsl(var(--primary))", className = "" }: ScoreRingProps) {
  const data = [
    { name: "Score", value: score, fill: color }
  ];

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="75%"
          outerRadius="100%"
          barSize={strokeWidth}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, max]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: "var(--muted)" }}
            dataKey="value"
            cornerRadius={strokeWidth / 2}
            angleAxisId={0}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tighter">{score != null ? score.toFixed(1) : '—'}</span>
        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-widest">Score</span>
      </div>
    </div>
  );
}
