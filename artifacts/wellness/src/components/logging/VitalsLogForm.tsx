import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, Heart, Thermometer, Weight } from 'lucide-react';

export function VitalsLogForm({ onSubmit, onCancel }: { onSubmit?: (data: any) => void, onCancel?: () => void }) {
  const [hr, setHr] = useState("");
  const [bp, setBp] = useState("");
  const [tempF, setTempF] = useState("");
  const [weight, setWeight] = useState("");

  const handleSubmit = () => {
    let bpSys, bpDia;
    if (bp.includes('/')) {
      const parts = bp.split('/');
      bpSys = parseInt(parts[0]);
      bpDia = parseInt(parts[1]);
    }
    onSubmit?.({ hr, bpSys, bpDia, tempF, weight });
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 pb-2">
        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl text-red-500 shadow-inner">
          <Activity className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Log Vitals</h3>
          <p className="text-sm text-slate-500">Enter your health metrics for today</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <Label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Heart className="h-4 w-4 text-rose-500" />
              <span>Heart Rate (bpm)</span>
            </Label>
            <Input type="number" placeholder="e.g. 72" value={hr} onChange={e => setHr(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-3">
            <Label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Activity className="h-4 w-4 text-blue-500" />
              <span>Blood Pressure</span>
            </Label>
            <Input placeholder="120/80" value={bp} onChange={e => setBp(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <Label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Thermometer className="h-4 w-4 text-orange-500" />
              <span>Temperature (°F)</span>
            </Label>
            <Input type="number" placeholder="98.6" value={tempF} onChange={e => setTempF(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>
          <div className="space-y-3">
            <Label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Weight className="h-4 w-4 text-emerald-500" />
              <span>Weight (lbs)</span>
            </Label>
            <Input type="number" placeholder="150" value={weight} onChange={e => setWeight(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800" />
          </div>
        </div>
      </div>

      <div className="flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" className="w-full text-slate-600 dark:text-slate-400" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="w-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md" onClick={handleSubmit}>
          Save Vitals
        </Button>
      </div>
    </div>
  );
}
