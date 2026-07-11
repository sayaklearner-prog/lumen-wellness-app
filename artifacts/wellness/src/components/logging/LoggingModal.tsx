import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Droplet, Smile, Activity, Pill, Plus } from 'lucide-react';
import { WaterLogForm } from './WaterLogForm';
import { MoodLogForm } from './MoodLogForm';
import { VitalsLogForm } from './VitalsLogForm';
import { MedicationLogForm } from './MedicationLogForm';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  useCreateHydration,
  useCreateMentalWellness,
  useCreateVital,
  useCreateMedication,
  getGetTimelineQueryKey
} from "@workspace/api-client-react";

export function LoggingModal({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('water');
  const qc = useQueryClient();
  const { toast } = useToast();

  const createHydration = useCreateHydration();
  const createMood = useCreateMentalWellness();
  const createVital = useCreateVital();
  const createMedication = useCreateMedication();

  const handleSuccess = (title: string) => {
    qc.invalidateQueries({ queryKey: getGetTimelineQueryKey() });
    toast({ title, description: "Your entry has been saved." });
    setOpen(false);
  };

  const handleWaterSubmit = async (amount: number) => {
    try {
      await createHydration.mutateAsync({ data: { amountMl: amount, beverageType: "water" } });
      handleSuccess("Hydration logged");
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleMoodSubmit = async (data: any) => {
    try {
      const moodMap: any = { "awful": 1, "bad": 2, "okay": 3, "good": 4, "great": 5 };
      await createMood.mutateAsync({ 
        data: { moodScore: moodMap[data.mood] || 3, stressLevel: 3, notes: data.notes } 
      });
      handleSuccess("Mood logged");
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleVitalsSubmit = async (data: any) => {
    try {
      await createVital.mutateAsync({ 
        data: {
          heartRateBpm: data.hr ? parseInt(data.hr) : undefined,
          bloodPressureSystolic: data.bpSys ? parseInt(data.bpSys) : undefined,
          bloodPressureDiastolic: data.bpDia ? parseInt(data.bpDia) : undefined,
          bodyTemperatureCelsius: data.tempF ? (parseFloat(data.tempF) - 32) * 5/9 : undefined,
        }
      });
      handleSuccess("Vitals logged");
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleMedsSubmit = async (data: any) => {
    try {
      await createMedication.mutateAsync({ 
        data: { name: data[0]?.name || "Unknown", dosage: data[0]?.dosage || "", taken: data[0]?.taken || true, scheduledFor: "" } 
      });
      handleSuccess("Medication logged");
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xl rounded-full px-6 hover:scale-105 transition-transform duration-200">
            <Plus className="h-5 w-5 mr-2" />
            Log Health Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-slate-100 dark:to-slate-400">
              New Entry
            </DialogTitle>
          </DialogHeader>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pt-2 pb-4">
            <TabsList className="grid w-full grid-cols-4 bg-slate-100/80 dark:bg-slate-900/50 p-1.5 rounded-2xl h-auto">
              <TabsTrigger 
                value="water" 
                className="rounded-xl py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
              >
                <Droplet className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger 
                value="mood" 
                className="rounded-xl py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-yellow-500 data-[state=active]:shadow-sm transition-all"
              >
                <Smile className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger 
                value="vitals" 
                className="rounded-xl py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-red-500 data-[state=active]:shadow-sm transition-all"
              >
                <Activity className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger 
                value="meds" 
                className="rounded-xl py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-purple-500 data-[state=active]:shadow-sm transition-all"
              >
                <Pill className="h-5 w-5" />
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6 pt-2 bg-white dark:bg-slate-950">
            <TabsContent value="water" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <WaterLogForm onCancel={() => setOpen(false)} onSubmit={handleWaterSubmit} />
            </TabsContent>
            <TabsContent value="mood" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <MoodLogForm onCancel={() => setOpen(false)} onSubmit={handleMoodSubmit} />
            </TabsContent>
            <TabsContent value="vitals" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <VitalsLogForm onCancel={() => setOpen(false)} onSubmit={handleVitalsSubmit} />
            </TabsContent>
            <TabsContent value="meds" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <MedicationLogForm onCancel={() => setOpen(false)} onSubmit={handleMedsSubmit} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
