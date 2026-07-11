export function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function scoreColor(category: string): string {
  switch(category.toLowerCase()) {
    case 'nutrition': return 'text-[var(--color-chart-1)]';
    case 'sleep': return 'text-[var(--color-chart-2)]';
    case 'activity': return 'text-[var(--color-chart-3)]';
    case 'screen': return 'text-[var(--color-chart-4)]';
    default: return 'text-primary';
  }
}

export function scoreBgColor(category: string): string {
  switch(category.toLowerCase()) {
    case 'nutrition': return 'bg-[var(--color-chart-1)]';
    case 'sleep': return 'bg-[var(--color-chart-2)]';
    case 'activity': return 'bg-[var(--color-chart-3)]';
    case 'screen': return 'bg-[var(--color-chart-4)]';
    default: return 'bg-primary';
  }
}
