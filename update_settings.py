import re

with open("artifacts/wellness/src/pages/settings.tsx", "r") as f:
    content = f.read()

# Add new imports
new_imports = """
import { 
  useGetMyProfile, 
  useUpdateMyProfile, 
  useListReminders, 
  useCreateReminder, 
  useUpdateReminder, 
  useDeleteReminder,
  getListRemindersQueryKey
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
"""
content = re.sub(r'import { useGetMyProfile.*?from "@workspace/api-client-react";', new_imports.strip(), content, flags=re.DOTALL)

# Add hooks inside component
hooks = """
  const { data: reminders, isLoading: isLoadingReminders } = useListReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState("08:00");
  const [newReminderTitle, setNewReminderTitle] = useState("");
"""

content = content.replace("const queryClient = useQueryClient();", "const queryClient = useQueryClient();\n" + hooks)

# Replace the reminders Card block
reminders_block_start = content.find("{/* REMINDERS */}")
reminders_block_end = content.find("</Card>", reminders_block_start) + 7

new_reminders_block = """{/* REMINDERS */}
          <Card className="border-emerald-900/30 bg-emerald-950/10 backdrop-blur-xl shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-semibold text-slate-100">Reminders</h2>
                </div>
                
                <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center text-xs font-medium text-slate-300 bg-emerald-950/30 border border-emerald-900/50 hover:bg-emerald-900/50 transition-colors px-3 py-1.5 rounded-full">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[420px] bg-emerald-950 border-emerald-900/50 text-slate-100 rounded-3xl">
                    <DialogHeader>
                      <DialogTitle>Add Reminder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Input type="time" value={newReminderTime} onChange={e => setNewReminderTime(e.target.value)} className="bg-emerald-900/20 border-emerald-800" />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input placeholder="e.g. Hydration check" value={newReminderTitle} onChange={e => setNewReminderTitle(e.target.value)} className="bg-emerald-900/20 border-emerald-800" />
                      </div>
                      <button 
                        disabled={!newReminderTitle}
                        onClick={() => {
                          createReminder.mutate({ data: { title: newReminderTitle, time: newReminderTime, category: 'general', enabled: true, repeatDays: ["MON","TUE","WED","THU","FRI","SAT","SUN"], aiGenerated: false } }, {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() });
                              setNewReminderTitle("");
                              setIsReminderOpen(false);
                            }
                          });
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Save Reminder
                      </button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="text-xs text-slate-400 mb-4">Smart nudges throughout your day</p>

              <div className="space-y-3">
                {isLoadingReminders ? (
                  <div className="flex justify-center p-4"><Loader2 className="animate-spin w-5 h-5 text-emerald-500" /></div>
                ) : reminders?.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No reminders active.</p>
                ) : (
                  reminders?.map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl group">
                      <div className="flex items-start gap-4">
                        <Switch 
                          checked={reminder.enabled} 
                          onCheckedChange={(val) => {
                            updateReminder.mutate({ reminderId: reminder.id, data: { enabled: val } }, {
                              onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() })
                            });
                          }}
                          className="data-[state=checked]:bg-emerald-600 mt-1" 
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">{reminder.time}</span>
                            <span className="text-sm font-medium text-slate-300">{reminder.title}</span>
                            {reminder.aiGenerated && (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 py-0">AI</Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 tracking-wider">{reminder.repeatDays?.join(", ")}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          deleteReminder.mutate({ reminderId: reminder.id }, {
                            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey() })
                          });
                        }}
                        className="text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>"""

content = content[:reminders_block_start] + new_reminders_block + content[reminders_block_end:]

with open("artifacts/wellness/src/pages/settings.tsx", "w") as f:
    f.write(content)

print("Updated settings.tsx successfully")
