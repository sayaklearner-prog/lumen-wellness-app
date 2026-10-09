import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Switch,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { storage } from "@/services/storage";
import { playAlarmSound, stopAlarm } from "@/services/alarm";
import {
  Bell,
  Plus,
  Trash2,
  Sparkles,
  Volume2,
  VolumeX,
  Clock,
  Check,
  X,
  Activity,
  AlertCircle,
  Flame,
} from "lucide-react-native";
import { useSlideMenu } from "@/context/SlideMenuContext";

import { getAlarms, saveAlarm, deleteAlarm as deleteAlarmDb } from "@/services/db";

export interface AlarmReminder {
  id: string;
  time: string; // HH:mm format
  title: string;
  repeat: string;
  enabled: boolean;
  isAi?: boolean;
  soundEnabled: boolean;
}

const INITIAL_REMINDERS: AlarmReminder[] = [
  {
    id: "rem-1",
    time: "07:30",
    title: "Morning hydration check",
    repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
    enabled: true,
    isAi: false,
    soundEnabled: true,
  },
  {
    id: "rem-2",
    time: "11:00",
    title: "Stand + stretch break",
    repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
    enabled: true,
    isAi: true,
    soundEnabled: true,
  },
  {
    id: "rem-3",
    time: "14:30",
    title: "Post-lunch glucose walk",
    repeat: "MON, TUE, WED, THU, FRI",
    enabled: true,
    isAi: false,
    soundEnabled: true,
  },
  {
    id: "rem-4",
    time: "21:30",
    title: "Wind down & Sleep prep",
    repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
    enabled: true,
    isAi: false,
    soundEnabled: true,
  },
];

export default function RemindersScreen() {
  const router = useRouter();
  const { openLeftMenu } = useSlideMenu();

  const [reminders, setReminders] = useState<AlarmReminder[]>(INITIAL_REMINDERS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTime, setNewTime] = useState("08:00");
  const [newTitle, setNewTitle] = useState("");
  const [newIsAi, setNewIsAi] = useState(false);
  const [newSound, setNewSound] = useState(true);

  // Active ringing alarm state
  const [ringingAlarm, setRingingAlarm] = useState<AlarmReminder | null>(null);
  const [isTestRinging, setIsTestRinging] = useState(false);
  const activeAlarmController = useRef<{ stop: () => void } | null>(null);
  const lastTriggeredMinute = useRef<string>("");

  // Load saved reminders from SQLite master DB & storage
  useEffect(() => {
    async function loadAlarms() {
      try {
        const dbAlarms = await getAlarms();
        if (dbAlarms && dbAlarms.length > 0) {
          setReminders(dbAlarms);
          return;
        }
        const stored = await storage.getItem("lumen_reminders_alarms");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setReminders(parsed);
          }
        }
      } catch (err) {
        console.warn("Could not load alarms:", err);
      }
    }
    loadAlarms();
  }, []);

  // Save helper
  const saveRemindersToStorage = async (list: AlarmReminder[]) => {
    setReminders(list);
    try {
      await storage.setItem("lumen_reminders_alarms", JSON.stringify(list));
      for (const a of list) {
        await saveAlarm({
          id: a.id,
          time: a.time,
          title: a.title,
          repeat: a.repeat,
          enabled: a.enabled,
          isAi: a.isAi,
          soundEnabled: a.soundEnabled,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {}
  };

  // Real-time minute alarm watcher
  useEffect(() => {
    const checkClockInterval = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentClockStr = `${currentHours}:${currentMinutes}`;

      // Avoid double-firing in the same minute
      if (lastTriggeredMinute.current === currentClockStr) {
        return;
      }

      const matched = reminders.find((r) => r.enabled && r.time === currentClockStr);
      if (matched) {
        lastTriggeredMinute.current = currentClockStr;
        triggerAlarmRing(matched);
      }
    }, 5000);

    return () => clearInterval(checkClockInterval);
  }, [reminders]);

  // Start ringing an alarm
  const triggerAlarmRing = (reminder: AlarmReminder) => {
    setRingingAlarm(reminder);
    if (reminder.soundEnabled) {
      activeAlarmController.current = playAlarmSound(15);
    }
  };

  // Stop current ringing alarm
  const handleDismissAlarm = () => {
    if (activeAlarmController.current) {
      activeAlarmController.current.stop();
      activeAlarmController.current = null;
    }
    stopAlarm();
    setRingingAlarm(null);
    setIsTestRinging(false);
  };

  // Snooze for 5 minutes
  const handleSnoozeAlarm = () => {
    handleDismissAlarm();
    Alert.alert("Snoozed", "Alarm snoozed for 5 minutes.");
    setTimeout(() => {
      if (ringingAlarm) {
        triggerAlarmRing(ringingAlarm);
      }
    }, 5 * 60 * 1000);
  };

  // Test ring sound preview
  const handleTestPreviewRing = (rem?: AlarmReminder) => {
    const target = rem || {
      id: "test",
      time: "08:00",
      title: "Sample Alarm Tone Preview",
      repeat: "DAILY",
      enabled: true,
      soundEnabled: true,
    };
    setIsTestRinging(true);
    triggerAlarmRing(target);
  };

  // Toggle reminder enabled
  const handleToggle = (id: string, val: boolean) => {
    const updated = reminders.map((r) => (r.id === id ? { ...r, enabled: val } : r));
    saveRemindersToStorage(updated);
  };

  // Toggle sound enabled
  const handleToggleSound = (id: string, val: boolean) => {
    const updated = reminders.map((r) => (r.id === id ? { ...r, soundEnabled: val } : r));
    saveRemindersToStorage(updated);
  };

  // Delete reminder
  const handleDelete = (id: string) => {
    const updated = reminders.filter((r) => r.id !== id);
    saveRemindersToStorage(updated);
  };

  // Add new reminder
  const handleAddReminder = () => {
    if (!newTitle.trim()) {
      Alert.alert("Missing Title", "Please enter a reminder title.");
      return;
    }

    const newItem: AlarmReminder = {
      id: `rem-${Date.now()}`,
      time: newTime.trim() || "08:00",
      title: newTitle.trim(),
      repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
      enabled: true,
      isAi: newIsAi,
      soundEnabled: newSound,
    };

    const updated = [...reminders, newItem];
    saveRemindersToStorage(updated);
    setNewTitle("");
    setShowAddModal(false);
    Alert.alert("Alarm Created! ⏰", `Scheduled for ${newItem.time}.`);
  };

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Pressable onPress={openLeftMenu} style={styles.menuIconBox}>
            <View style={styles.brandDot} />
          </Pressable>
          <Text style={styles.brandTitle}>Lumen Alarms</Text>
        </View>

        <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Plus size={16} color="#050b08" />
          <Text style={styles.addBtnText}>Add Alarm</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <View style={styles.heroBox}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroSub}>Smart Scheduling</Text>
            <Text style={styles.heroTitle}>Audible Reminders</Text>
            <Text style={styles.heroDesc}>
              Active nudges synthesize loud acoustic bell chimes and device vibration when triggered.
            </Text>
          </View>
          <Bell size={36} color="#10b981" />
        </View>

        {/* Global Test Ring Button */}
        <Pressable style={styles.testRingBanner} onPress={() => handleTestPreviewRing()}>
          <View style={styles.testRingLeft}>
            <Volume2 size={20} color="#10b981" />
            <View>
              <Text style={styles.testRingTitle}>Preview Alarm Sound & Vibration</Text>
              <Text style={styles.testRingSub}>Tap to verify acoustic bell chimes ring loudly</Text>
            </View>
          </View>
          <Text style={styles.testRingBadge}>Test ➔</Text>
        </Pressable>

        {/* Reminders List */}
        <View style={styles.sectionTitleRow}>
          <Clock size={16} color="#94a3b8" />
          <Text style={styles.sectionTitle}>Scheduled Alarms ({reminders.length})</Text>
        </View>

        <View style={styles.listContainer}>
          {reminders.map((rem) => (
            <View key={rem.id} style={[styles.alarmCard, !rem.enabled && styles.alarmCardDisabled]}>
              <View style={styles.alarmTopRow}>
                <View style={styles.timeGroup}>
                  <Text style={[styles.alarmTime, !rem.enabled && styles.alarmTimeDisabled]}>
                    {rem.time}
                  </Text>
                  {rem.isAi && (
                    <View style={styles.aiBadge}>
                      <Sparkles size={10} color="#10b981" />
                      <Text style={styles.aiBadgeText}>AI Nudge</Text>
                    </View>
                  )}
                </View>

                <Switch
                  value={rem.enabled}
                  onValueChange={(val) => handleToggle(rem.id, val)}
                  trackColor={{ false: "#1e293b", true: "#10b981" }}
                  thumbColor={rem.enabled ? "#050b08" : "#94a3b8"}
                />
              </View>

              <Text style={[styles.alarmTitle, !rem.enabled && styles.alarmTitleDisabled]}>
                {rem.title}
              </Text>
              <Text style={styles.alarmRepeat}>{rem.repeat}</Text>

              {/* Bottom Controls of Card */}
              <View style={styles.cardActionsRow}>
                <Pressable
                  style={styles.soundToggleBtn}
                  onPress={() => handleToggleSound(rem.id, !rem.soundEnabled)}
                >
                  {rem.soundEnabled ? (
                    <>
                      <Volume2 size={14} color="#10b981" />
                      <Text style={styles.soundToggleText}>Sound On</Text>
                    </>
                  ) : (
                    <>
                      <VolumeX size={14} color="#64748b" />
                      <Text style={[styles.soundToggleText, { color: "#64748b" }]}>Muted</Text>
                    </>
                  )}
                </Pressable>

                <Pressable style={styles.previewBtn} onPress={() => handleTestPreviewRing(rem)}>
                  <Bell size={13} color="#f8fafc" />
                  <Text style={styles.previewBtnText}>Test Ring</Text>
                </Pressable>

                <Pressable style={styles.deleteBtn} onPress={() => handleDelete(rem.id)}>
                  <Trash2 size={16} color="#64748b" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Back to Today */}
        <Pressable style={styles.backBtn} onPress={() => router.push("/(tabs)")}>
          <Text style={styles.backBtnText}>Return to Today Dashboard</Text>
        </Pressable>
      </ScrollView>

      {/* Ringing Alarm Modal */}
      <Modal visible={!!ringingAlarm} transparent animationType="fade">
        <View style={styles.alarmModalOverlay}>
          <View style={styles.ringingAlarmCard}>
            <View style={styles.ringingIconCircle}>
              <Bell size={40} color="#10b981" />
            </View>

            <Text style={styles.ringingTitle}>⏰ ALARM RINGING</Text>
            <Text style={styles.ringingClock}>{ringingAlarm?.time}</Text>
            <Text style={styles.ringingReminderTitle}>{ringingAlarm?.title}</Text>
            <Text style={styles.ringingSub}>Synthesized acoustic chime is active</Text>

            <View style={styles.ringingButtonsRow}>
              <Pressable style={styles.snoozeBtn} onPress={handleSnoozeAlarm}>
                <Text style={styles.snoozeBtnText}>Snooze 5m</Text>
              </Pressable>

              <Pressable style={styles.dismissBtn} onPress={handleDismissAlarm}>
                <Text style={styles.dismissBtnText}>Dismiss Alarm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Alarm Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.addModalOverlay}>
          <View style={styles.addModalCard}>
            <View style={styles.addModalHeader}>
              <Text style={styles.addModalTitle}>Set New Alarm</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.addInputGroup}>
              <Text style={styles.addInputLabel}>Alarm Time (HH:mm)</Text>
              <TextInput
                style={styles.addTextInput}
                value={newTime}
                onChangeText={setNewTime}
                placeholder="08:00"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.addInputGroup}>
              <Text style={styles.addInputLabel}>Reminder Label</Text>
              <TextInput
                style={styles.addTextInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Afternoon stretch & water"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.addSwitchRow}>
              <View>
                <Text style={styles.addSwitchTitle}>Audible Sound & Vibration</Text>
                <Text style={styles.addSwitchDesc}>Plays acoustic bell chords when triggered</Text>
              </View>
              <Switch
                value={newSound}
                onValueChange={setNewSound}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={newSound ? "#050b08" : "#94a3b8"}
              />
            </View>

            <View style={styles.addSwitchRow}>
              <View>
                <Text style={styles.addSwitchTitle}>AI Adaptive Nudge</Text>
                <Text style={styles.addSwitchDesc}>Optimizes timing according to biometrics</Text>
              </View>
              <Switch
                value={newIsAi}
                onValueChange={setNewIsAi}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={newIsAi ? "#050b08" : "#94a3b8"}
              />
            </View>

            <Pressable style={styles.createAlarmBtn} onPress={handleAddReminder}>
              <Text style={styles.createAlarmBtnText}>Save Alarm</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30, 41, 59, 0.7)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: "#050b08",
    fontWeight: "bold",
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 18,
  },
  heroBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 14,
  },
  heroSub: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  heroDesc: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  testRingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 16,
    padding: 14,
  },
  testRingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  testRingTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  testRingSub: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  testRingBadge: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "bold",
    paddingLeft: 8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  listContainer: {
    gap: 12,
  },
  alarmCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 18,
    padding: 16,
  },
  alarmCardDisabled: {
    opacity: 0.6,
  },
  alarmTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alarmTime: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "900",
  },
  alarmTimeDisabled: {
    color: "#64748b",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "bold",
  },
  alarmTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },
  alarmTitleDisabled: {
    color: "#64748b",
  },
  alarmRepeat: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.6)",
  },
  soundToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  soundToggleText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewBtnText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "bold",
  },
  deleteBtn: {
    padding: 6,
  },
  backBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  backBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
  alarmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  ringingAlarmCard: {
    width: "100%",
    backgroundColor: "#070c0a",
    borderWidth: 2,
    borderColor: "#10b981",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  ringingIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ringingTitle: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  ringingClock: {
    color: "#f8fafc",
    fontSize: 44,
    fontWeight: "900",
    marginTop: 6,
  },
  ringingReminderTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 8,
  },
  ringingSub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 6,
  },
  ringingButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    width: "100%",
  },
  snoozeBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  snoozeBtnText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  dismissBtn: {
    flex: 1,
    backgroundColor: "#10b981",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissBtnText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "bold",
  },
  addModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  addModalCard: {
    backgroundColor: "#070c0a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(16, 185, 129, 0.3)",
    gap: 14,
  },
  addModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addModalTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "bold",
  },
  addInputGroup: {
    gap: 6,
  },
  addInputLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  addTextInput: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    color: "#f8fafc",
    fontSize: 15,
  },
  addSwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  addSwitchTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  addSwitchDesc: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  createAlarmBtn: {
    backgroundColor: "#10b981",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  createAlarmBtnText: {
    color: "#050b08",
    fontWeight: "bold",
    fontSize: 15,
  },
});
