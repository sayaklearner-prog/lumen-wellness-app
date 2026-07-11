import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pill, Plus } from 'lucide-react';

export function MedicationLogForm({ onSubmit, onCancel }: { onSubmit?: (data: any) => void, onCancel?: () => void }) {
  const [meds, setMeds] = useState([{ name: '', dose: '', taken: false }]);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 pb-2">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-2xl text-purple-600 shadow-inner">
          <Pill className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Log Medication</h3>
          <p className="text-sm text-slate-500">Record your daily supplements and meds</p>
        </div>
      </div>

      <div className="space-y-4">
        {meds.map((med, index) => (
          <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
            <div className="flex-1 space-y-1">
               <Label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Name</Label>
               <Input 
                 placeholder="Medication name" 
                 value={med.name} 
                 onChange={e => {
                   const newMeds = [...meds];
                   newMeds[index].name = e.target.value;
                   setMeds(newMeds);
                 }}
                 className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-9" 
               />
            </div>
            <div className="w-24 space-y-1">
               <Label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Dose</Label>
               <Input 
                 placeholder="e.g. 50mg" 
                 value={med.dose} 
                 onChange={e => {
                   const newMeds = [...meds];
                   newMeds[index].dose = e.target.value;
                   setMeds(newMeds);
                 }}
                 className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-9" 
               />
            </div>
            <div className="flex flex-col items-center justify-center space-y-1 pt-4 px-2">
               <input 
                 type="checkbox" 
                 checked={med.taken}
                 onChange={e => {
                   const newMeds = [...meds];
                   newMeds[index].taken = e.target.checked;
                   setMeds(newMeds);
                 }}
                 className="h-5 w-5 rounded border-slate-300 text-purple-600 focus:ring-purple-600 cursor-pointer" 
               />
               <Label className="text-[9px] uppercase font-bold text-slate-400">Taken</Label>
            </div>
          </div>
        ))}

        <Button 
          variant="outline" 
          className="w-full border-dashed border-2 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-purple-600 hover:border-purple-200 dark:hover:border-purple-900/50 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors py-6 rounded-xl" 
          onClick={() => setMeds([...meds, { name: '', dose: '', taken: false }])}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Another Medication
        </Button>
      </div>

      <div className="flex space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" className="w-full text-slate-600 dark:text-slate-400" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20" onClick={() => onSubmit?.(meds)}>
          Save Record
        </Button>
      </div>
    </div>
  );
}
