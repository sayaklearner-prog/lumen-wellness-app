import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Smile, Frown, Meh, Sun, CloudRain } from 'lucide-react';
import { cn } from '@/lib/utils';

const moods = [
  { id: 'great', icon: Sun, label: 'Great', activeColor: 'text-yellow-500 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20', defaultColor: 'text-yellow-500' },
  { id: 'good', icon: Smile, label: 'Good', activeColor: 'text-green-500 border-green-500 bg-green-50 dark:bg-green-900/20', defaultColor: 'text-green-500' },
  { id: 'okay', icon: Meh, label: 'Okay', activeColor: 'text-slate-600 dark:text-slate-300 border-slate-400 bg-slate-100 dark:bg-slate-800', defaultColor: 'text-slate-500' },
  { id: 'bad', icon: Frown, label: 'Bad', activeColor: 'text-orange-500 border-orange-500 bg-orange-50 dark:bg-orange-900/20', defaultColor: 'text-orange-500' },
  { id: 'awful', icon: CloudRain, label: 'Awful', activeColor: 'text-red-500 border-red-500 bg-red-50 dark:bg-red-900/20', defaultColor: 'text-red-500' },
];

export function MoodLogForm({ onSubmit, onCancel }: { onSubmit?: (data: any) => void, onCancel?: () => void }) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">How are you feeling?</h3>
        <p className="text-sm text-slate-500">Track your mood to understand your emotional well-being.</p>
      </div>

      <div className="flex justify-between items-center px-1">
        {moods.map((mood) => {
          const isActive = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              onClick={() => setSelectedMood(mood.id)}
              className={cn(
                "flex flex-col items-center p-3 rounded-2xl transition-all duration-300 border-2",
                isActive 
                  ? `${mood.activeColor} scale-110 shadow-sm` 
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-400 opacity-70 hover:opacity-100"
              )}
            >
              <mood.icon className={cn("h-8 w-8 mb-2 transition-transform duration-300", isActive ? "scale-110" : "", !isActive ? mood.defaultColor : "")} />
              <span className={cn("text-xs font-semibold", isActive ? "" : "text-slate-500")}>
                {mood.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 pt-2">
        <Label htmlFor="notes" className="text-slate-700 dark:text-slate-300 font-medium">Add a note (optional)</Label>
        <Textarea 
          id="notes" 
          placeholder="What's making you feel this way?" 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="resize-none h-24 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-1 focus-visible:ring-slate-300"
        />
      </div>

      <div className="flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" className="w-full text-slate-600 dark:text-slate-400" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          className="w-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md transition-all duration-200" 
          disabled={!selectedMood}
          onClick={() => onSubmit?.({ mood: selectedMood, notes })}
        >
          Log Mood
        </Button>
      </div>
    </div>
  );
}
