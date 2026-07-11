import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Droplet, Plus, Minus } from 'lucide-react';

export function WaterLogForm({ onSubmit, onCancel }: { onSubmit?: (amount: number) => void, onCancel?: () => void }) {
  const [amount, setAmount] = useState(250);
  const quickAmounts = [100, 250, 500, 1000];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-blue-100/50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 shadow-inner">
          <Droplet className="h-10 w-10 fill-current" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Log Water Intake</h3>
          <p className="text-sm text-slate-500 mt-1">Track your hydration to stay healthy and refreshed throughout the day.</p>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-6 py-4">
        <Button 
          variant="outline" 
          size="icon" 
          className="h-12 w-12 rounded-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800" 
          onClick={() => setAmount(Math.max(0, amount - 50))}
        >
          <Minus className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </Button>
        <div className="text-center min-w-[120px]">
          <span className="text-5xl font-bold tracking-tighter text-blue-600 dark:text-blue-400">{amount}</span>
          <span className="text-lg font-medium text-slate-400 ml-1">ml</span>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          className="h-12 w-12 rounded-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800" 
          onClick={() => setAmount(amount + 50)}
        >
          <Plus className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {quickAmounts.map((q) => (
          <Button 
            key={q} 
            variant="secondary" 
            className="w-full text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors" 
            onClick={() => setAmount(q)}
          >
            {q}ml
          </Button>
        ))}
      </div>

      <div className="flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20" onClick={() => onSubmit?.(amount)}>
          Save Log
        </Button>
      </div>
    </div>
  );
}
