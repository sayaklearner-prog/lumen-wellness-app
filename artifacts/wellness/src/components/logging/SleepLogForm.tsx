import React, { useState } from 'react';
import { useCreateSleep } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function SleepLogForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSleep = useCreateSleep();

  const [hours, setHours] = useState('8.0');
  const [quality, setQuality] = useState('good');
  const [bedtime, setBedtime] = useState('22:30');
  const [wakeTime, setWakeTime] = useState('06:30');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSleep.mutate(
      {
        data: {
          durationHours: parseFloat(hours),
          quality,
          bedtime,
          wakeTime,
          deepSleepHours: parseFloat(hours) * 0.25,
          date: new Date().toISOString()
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['getGetTodayDashboard'] });
          queryClient.invalidateQueries({ queryKey: ['getGetTimeline'] });
          queryClient.invalidateQueries({ queryKey: ['listSleep'] });
          toast({
            title: "Sleep logged",
            description: `Successfully logged ${hours} hours of sleep.`,
          });
          onSubmit();
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to log sleep.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="hours">Total Sleep (Hours)</Label>
          <Input 
            id="hours" 
            type="number" 
            step="0.1" 
            value={hours} 
            onChange={(e) => setHours(e.target.value)} 
            required 
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bedtime">Bedtime</Label>
            <Input 
              id="bedtime" 
              type="time" 
              value={bedtime} 
              onChange={(e) => setBedtime(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wakeTime">Wake Time</Label>
            <Input 
              id="wakeTime" 
              type="time" 
              value={wakeTime} 
              onChange={(e) => setWakeTime(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quality">Sleep Quality</Label>
          <Select value={quality} onValueChange={setQuality}>
            <SelectTrigger>
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="poor">Poor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={createSleep.isPending}>
          {createSleep.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Sleep
        </Button>
      </div>
    </form>
  );
}
