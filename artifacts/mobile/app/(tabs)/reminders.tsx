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
import { playAlarmSound, stopAlarm, subscribeToAlarms } from "@/services/alarm";
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
  Droplets,
  Activity,
  AlertCircle,
  Flame,
  Menu,
} from "lucide-react-native";
import { useSlideMenu } from "@/context/SlideMenuContext";

import { getAlarms, saveAlarm, deleteAlarm as deleteAlarmDb } from "@/services/db";
import {
  sendLocalNotification,
  syncAllAlarmsWithNative,
  scheduleNativeAlarm,
  cancelNativeAlarm,
  snoozeNativeAlarm,
  stopNativeAlarmSound,
  stringToAlarmId,
} from "@/services/notifications";
import { useHydration } from "@/hooks/useHydration";
import THEME from "@/constants/theme";

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

function formatRepeatDays(repeat: string): string {
  if (!repeat) return "Once";
  const upper = repeat.toUpperCase().replace(/\s+/g, "");
  if (
    upper.includes("MON") &&
    upper.includes("TUE") &&
    upper.includes("WED") &&
    upper.includes("THU") &&
    upper.includes("FRI") &&
    upper.includes("SAT") &&
    upper.includes("SUN")
  ) {
    return "Every day";
  }
  if (
    upper.includes("MON") &&
    upper.includes("TUE") &&
    upper.includes("WED") &&
    upper.includes("THU") &&
    upper.includes("FRI") &&
    !upper.includes("SAT") &&
    !upper.includes("SUN")
  ) {
    return "Weekdays (Mon–Fri)";
  }
  if (
    !upper.includes("MON") &&
    !upper.includes("TUE") &&
    !upper.includes("WED") &&
    !upper.includes("THU") &&
    !upper.includes("FRI") &&
    upper.includes("SAT") &&
    upper.includes("SUN")
  ) {
    return "Weekends (Sat–Sun)";
  }
  return repeat;
}

export default function RemindersScreen() {
  const router = useRouter();
  const { openLeftMenu } = useSlideMenu();

  const [reminders, setReminders] = useState<AlarmReminder[]>(INITIAL_REMINDERS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTime, setNewTime] = useState("08:00");
  const [newTitle, setNewTitle] = useState("");
  const [newIsAi, setNewIsAi] = useState(false);
  const [newSound, setNewSound] = useState(true);

  // Hydration hook for synced controls
  const {
    hydration,
    toggleReminders: toggleHydrationReminders,
    setIntervalHours: setHydrationInterval,
    sendTestPrompt: sendHydrationTest,
  } = useHydration();

  // Active ringing alarm state
  const [ringingAlarm, setRingingAlarm] = useState<AlarmReminder | null>(null);
  const [isTestRinging, setIsTestRinging] = useState(false);
  const activeAlarmController = useRef<{ stop: () => void } | null>(null);
  const lastTriggeredMinute = useRef<string>("");

  // Load saved reminders from SQLite DB & storage, and arm native Android AlarmManager
  useEffect(() => {
    async function loadAlarms() {
      try {
        const dbAlarms = await getAlarms();
        if (dbAlarms && dbAlarms.length > 0) {
          setReminders(dbAlarms);
          syncAllAlarmsWithNative(dbAlarms);
          return;
        }
        const stored = await storage.getItem("lumen_reminders_alarms");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setReminders(parsed);
            syncAllAlarmsWithNative(parsed);
            return;
          }
        }
        // Fallback to initial reminders
        syncAllAlarmsWithNative(INITIAL_REMINDERS);
      } catch (err) {
        console.warn("Could not load alarms:", err);
      }
    }
    loadAlarms();
  }, []);

  // Subscribe to native Android and in-app alarm trigger events
  useEffect(() => {
    const unsub = subscribeToAlarms((alarm) => {
      triggerAlarmRing(alarm);
    });
    return () => unsub();
  }, []);

  // Save helper: updates UI, SQLite DB, storage, and native Android AlarmManager
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
      // Re-sync with native Android AlarmManager
      await syncAllAlarmsWithNative(list);
    } catch (e) {
      console.warn("Error saving reminders:", e);
    }
  };

  // Real-time foreground clock watcher
  useEffect(() => {
    const checkClockInterval = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentClockStr = `${currentHours}:${currentMinutes}`;

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

  // Start ringing an alarm (loud looping tone & full-screen ringing HUD)
  const triggerAlarmRing = (reminder: AlarmReminder) => {
    setRingingAlarm(reminder);
    if (reminder.soundEnabled) {
      activeAlarmController.current = playAlarmSound(60);
    }
    // High-priority native Android alarm notification
    sendLocalNotification({
      id: stringToAlarmId(reminder.id),
      title: `⏰ ${reminder.title}`,
      body: `Scheduled alarm for ${reminder.time} is ringing.`,
      channelId: "lumen_alarms",
      isAlarm: true,
    });
  };

  // Stop current ringing alarm
  const handleDismissAlarm = () => {
    if (activeAlarmController.current) {
      activeAlarmController.current.stop();
      activeAlarmController.current = null;
    }
    stopAlarm();
    stopNativeAlarmSound();
    setRingingAlarm(null);
    setIsTestRinging(false);
  };

  // Snooze for 5 minutes
  const handleSnoozeAlarm = () => {
    if (ringingAlarm) {
      snoozeNativeAlarm(stringToAlarmId(ringingAlarm.id), 5);
    }
    handleDismissAlarm();
    Alert.alert("Alarm Snoozed ⏰", "We will ring again in 5 minutes.");
  };

  // Test ring sound preview
  const handleTestPreviewRing = (rem?: AlarmReminder) => {
    const target = rem || {
      id: "test",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
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
  const handleDelete = async (id: string) => {
    const updated = reminders.filter((r) => r.id !== id);
    await cancelNativeAlarm(id);
    try {
      await deleteAlarmDb(id);
    } catch {}
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
    Alert.alert("Alarm Created! ⏰", `Armed for ${newItem.time} daily.`);
  };

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Pressable
            onPress={openLeftMenu}
            accessibilityLabel="Open Navigation Slide Menu"
            style={styles.hamburgerBtn}
          >
            <Menu size={19} color="#10b981" />
          </Pressable>

          <View style={styles.brandTextCol}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle} numberOfLines={1} ellipsizeMode="tail">
                ALARMS
              </Text>
              <View style={styles.brandPill}>
                <Text style={styles.brandPillText}>LUMEN</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle} numberOfLines={1} ellipsizeMode="tail">
              Biometric Prompts & Sync
            </Text>
          </View>
        </View>

        <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Plus size={15} color="#050b08" />
          <Text style={styles.addBtnText}>Add Alarm</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <View style={styles.heroBox}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroSub} numberOfLines={1}>Production Bio-Alarms</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>Smart Phone Alarms</Text>
            <Text style={styles.heroDesc} numberOfLines={3} ellipsizeMode="tail">
              Rings loudly via Android AlarmManager even when the app is closed, screen is locked, or phone is on silent mode.
            </Text>
          </View>
          <Bell size={34} color="#10b981" style={{ flexShrink: 0 }} />
        </View>

        {/* Global Test Ring Button */}
        <Pressable style={styles.testRingBanner} onPress={() => handleTestPreviewRing()}>
          <View style={styles.testRingLeft}>
            <Volume2 size={20} color="#10b981" style={{ flexShrink: 0 }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.testRingTitle} numberOfLines={1} ellipsizeMode="tail">Preview Alarm Sound & Vibration</Text>
              <Text style={styles.testRingSub} numberOfLines={1} ellipsizeMode="tail">Tap to verify loud acoustic alarm ring and vibration</Text>
            </View>
          </View>
          <Text style={styles.testRingBadge}>Test ➔</Text>
        </Pressable>

        {/* SMART HYDRATION SECTION CARD */}
        <View style={styles.hydrationReminderCard}>
          <View style={styles.hydrationCardHeader}>
            <View style={styles.hydrationCardIconBox}>
              <Droplets size={22} color="#06b6d4" />
            </View>
            <View style={styles.hydrationHeaderInfo}>
              <View style={styles.hydrationTitleBadgeRow}>
                <Text style={styles.hydrationCardTitle} numberOfLines={1} ellipsizeMode="tail">
                  Cellular Hydration
                </Text>
                <View
                  style={[
                    styles.hydrationLiveBadge,
                    {
                      backgroundColor: hydration.remindersEnabled
                        ? "rgba(6, 182, 212, 0.15)"
                        : "rgba(100, 116, 139, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.hydrationLiveBadgeText,
                      { color: hydration.remindersEnabled ? "#06b6d4" : "#94a3b8" },
                    ]}
                  >
                    {hydration.remindersEnabled ? "ACTIVE" : "OFF"}
                  </Text>
                </View>
              </View>
              <Text style={styles.hydrationCardSub} numberOfLines={1} ellipsizeMode="tail">
                {hydration.remindersEnabled
                  ? `Next prompt: ${hydration.nextPromptTimeStr || "Scheduled"}`
                  : "Daytime fluid reminders disabled"}
              </Text>
            </View>
            <Switch
              value={hydration.remindersEnabled}
              onValueChange={(val) => {
                toggleHydrationReminders(val);
              }}
              trackColor={{ false: "#1e293b", true: "#06b6d4" }}
              thumbColor={hydration.remindersEnabled ? "#ffffff" : "#94a3b8"}
              style={styles.headerSwitch}
            />
          </View>

          {hydration.remindersEnabled && (
            <View style={styles.hydrationConfigBox}>
              <Text style={styles.hydrationConfigLabel}>PROMPT FREQUENCY (8:00 AM – 10:00 PM)</Text>
              <View style={styles.intervalChipsRow}>
                {[
                  { label: "1h", val: 1 },
                  { label: "1.5h", val: 1.5 },
                  { label: "2h", val: 2 },
                  { label: "3h", val: 3 },
                ].map((chip) => {
                  const isSelected = hydration.reminderIntervalHours === chip.val;
                  return (
                    <Pressable
                      key={chip.val}
                      style={[styles.intervalChip, isSelected && styles.intervalChipActive]}
                      onPress={() => setHydrationInterval(chip.val)}
                    >
                      <Text
                        style={[
                          styles.intervalChipText,
                          isSelected && styles.intervalChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.hydrationTestRow}>
                <View style={styles.hydrationIntakeProgress}>
                  <Text style={styles.hydrationProgressText} numberOfLines={1} ellipsizeMode="tail">
                    Today: {hydration.todayMl.toLocaleString()} / {hydration.targetMl.toLocaleString()} ml
                  </Text>
                </View>
                <Pressable
                  style={styles.hydrationTestBtn}
                  onPress={() => {
                    sendHydrationTest();
                    Alert.alert("💧 Hydration Nudge Sent", "Check your notification tray!");
                  }}
                >
                  <Bell size={12} color="#06b6d4" />
                  <Text style={styles.hydrationTestBtnText}>Test Nudge</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

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
                  style={{ flexShrink: 0 }}
                />
              </View>

              <Text style={[styles.alarmTitle, !rem.enabled && styles.alarmTitleDisabled]} numberOfLines={1} ellipsizeMode="tail">
                {rem.title}
              </Text>
              <Text style={styles.alarmRepeat} numberOfLines={1} ellipsizeMode="tail">
                {formatRepeatDays(rem.repeat)}
              </Text>

              {/* Bottom Controls of Card */}
              <View style={styles.cardActionsRow}>
                <Pressable
                  style={styles.soundToggleBtn}
                  onPress={() => handleToggleSound(rem.id, !rem.soundEnabled)}
                >
                  {rem.soundEnabled ? (
                    <>
                      <Volume2 size={14} color="#10b981" />
                      <Text style={styles.soundToggleText} numberOfLines={1}>Loud Alarm</Text>
                    </>
                  ) : (
                    <>
                      <VolumeX size={14} color="#64748b" />
                      <Text style={[styles.soundToggleText, { color: "#64748b" }]} numberOfLines={1}>Muted</Text>
                    </>
                  )}
                </Pressable>

                <View style={styles.cardRightActions}>
                  <Pressable style={styles.previewBtn} onPress={() => handleTestPreviewRing(rem)}>
                    <Bell size={13} color="#f8fafc" />
                    <Text style={styles.previewBtnText}>Test</Text>
                  </Pressable>

                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(rem.id)} accessibilityLabel="Delete reminder">
                    <Trash2 size={16} color="#64748b" />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Back to Today */}
        <Pressable style={styles.backBtn} onPress={() => router.push("/(tabs)")}>
          <Text style={styles.backBtnText}>Return to Today Dashboard</Text>
        </Pressable>
      </ScrollView>

      {/* Ringing Alarm Modal (Full-Screen Glowing HUD) */}
      <Modal visible={!!ringingAlarm} transparent animationType="fade">
        <View style={styles.alarmModalOverlay}>
          <View style={styles.ringingAlarmCard}>
            <View style={styles.ringingIconCircle}>
              <Bell size={44} color="#10b981" />
            </View>

            <Text style={styles.ringingTitle}>⏰ PHONE ALARM RINGING</Text>
            <Text style={styles.ringingClock}>{ringingAlarm?.time}</Text>
            <Text style={styles.ringingReminderTitle}>{ringingAlarm?.title}</Text>
            <Text style={styles.ringingSub}>Continuous loud alarm tone & vibration active</Text>

            <View style={styles.ringingButtonsRow}>
              <Pressable style={styles.snoozeBtn} onPress={handleSnoozeAlarm}>
                <Text style={styles.snoozeBtnText}>Snooze (+5m)</Text>
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
              <Text style={styles.addModalTitle}>Set New Phone Alarm</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.addInputGroup}>
              <Text style={styles.addInputLabel}>Alarm Time (HH:mm format, e.g. 07:30)</Text>
              <TextInput
                style={styles.addTextInput}
                value={newTime}
                onChangeText={setNewTime}
                placeholder="07:30"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.addInputGroup}>
              <Text style={styles.addInputLabel}>Reminder Label</Text>
              <TextInput
                style={styles.addTextInput}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="e.g. Morning hydration & stretch"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={styles.addSwitchRow}>
              <View style={styles.addSwitchTextContainer}>
                <Text style={styles.addSwitchTitle} numberOfLines={1} ellipsizeMode="tail">Loud Alarm & Vibration</Text>
                <Text style={styles.addSwitchDesc} numberOfLines={2}>Rings continuous phone alarm even if sleeping</Text>
              </View>
              <Switch
                value={newSound}
                onValueChange={setNewSound}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={newSound ? "#050b08" : "#94a3b8"}
                style={{ flexShrink: 0 }}
              />
            </View>

            <View style={styles.addSwitchRow}>
              <View style={styles.addSwitchTextContainer}>
                <Text style={styles.addSwitchTitle} numberOfLines={1} ellipsizeMode="tail">AI Adaptive Timing</Text>
                <Text style={styles.addSwitchDesc} numberOfLines={2}>Nudges according to circadian biometric peak</Text>
              </View>
              <Switch
                value={newIsAi}
                onValueChange={setNewIsAi}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={newIsAi ? "#050b08" : "#94a3b8"}
                style={{ flexShrink: 0 }}
              />
            </View>

            <Pressable style={styles.createAlarmBtn} onPress={handleAddReminder}>
              <Text style={styles.createAlarmBtnText}>Arm Alarm (Exact Native)</Text>
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
    backgroundColor: THEME.colors.bgSolid,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 52 : 36,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    maxWidth: "100%",
  },
  brandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 10,
  },
  hamburgerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  brandTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
    letterSpacing: 1.1,
  },
  brandPill: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  brandPillText: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: THEME.colors.accentGreen,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexShrink: 0,
  },
  addBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 12.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
    maxWidth: "100%",
  },
  heroBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 24,
    padding: 18,
    maxWidth: "100%",
    ...THEME.shadows.card,
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  heroSub: {
    color: THEME.colors.accentGreen,
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  heroDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  testRingBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 20,
    padding: 14,
    maxWidth: "100%",
    ...THEME.shadows.cardLight,
  },
  testRingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  testRingTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "bold",
  },
  testRingSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  testRingBadge: {
    color: THEME.colors.accentGreen,
    fontSize: 12,
    fontWeight: "bold",
    paddingLeft: 8,
    flexShrink: 0,
  },
  // Hydration card styles
  hydrationReminderCard: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.3)",
    borderRadius: 24,
    padding: 16,
    maxWidth: "100%",
    ...THEME.shadows.card,
  },
  hydrationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: "100%",
  },
  hydrationCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hydrationHeaderInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  hydrationTitleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  hydrationCardTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  headerSwitch: {
    flexShrink: 0,
  },
  hydrationCardSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  hydrationLiveBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 0,
  },
  hydrationLiveBadgeText: {
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  hydrationConfigBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 218, 210, 0.25)",
  },
  hydrationConfigLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  intervalChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  intervalChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    backgroundColor: "rgba(232, 241, 237, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  intervalChipActive: {
    backgroundColor: "#06b6d4",
    borderColor: "#06b6d4",
  },
  intervalChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
  },
  intervalChipTextActive: {
    color: "#ffffff",
    fontWeight: "900",
  },
  hydrationTestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  hydrationIntakeProgress: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  hydrationProgressText: {
    fontSize: 11,
    fontWeight: "600",
    color: THEME.colors.cardTextSecondary,
  },
  hydrationTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
  },
  hydrationTestBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#06b6d4",
  },
  // Section title & list
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  listContainer: {
    gap: 12,
  },
  alarmCard: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 24,
    padding: 16,
    maxWidth: "100%",
    ...THEME.shadows.card,
  },
  alarmCardDisabled: {
    opacity: 0.55,
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 28,
    fontWeight: "900",
  },
  alarmTimeDisabled: {
    color: THEME.colors.cardTextTertiary,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: {
    color: THEME.colors.accentGreen,
    fontSize: 10,
    fontWeight: "bold",
  },
  alarmTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  alarmTitleDisabled: {
    color: THEME.colors.cardTextTertiary,
  },
  alarmRepeat: {
    color: THEME.colors.cardTextSecondary,
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
    borderTopColor: "rgba(200, 218, 210, 0.4)",
    maxWidth: "100%",
  },
  cardRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  soundToggleBtn: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  soundToggleText: {
    color: THEME.colors.accentGreen,
    fontSize: 12,
    fontWeight: "600",
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(232, 241, 237, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewBtnText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 11.5,
    fontWeight: "bold",
  },
  deleteBtn: {
    padding: 6,
  },
  backBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    backgroundColor: "rgba(232, 241, 237, 0.08)",
  },
  backBtnText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  alarmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  ringingAlarmCard: {
    width: "100%",
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 2,
    borderColor: THEME.colors.accentGreen,
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
    ...THEME.shadows.card,
  },
  ringingIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ringingTitle: {
    color: THEME.colors.accentGreen,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  ringingClock: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 48,
    fontWeight: "900",
    marginVertical: 4,
  },
  ringingReminderTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  ringingSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 20,
    textAlign: "center",
  },
  ringingButtonsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  snoozeBtn: {
    flex: 1,
    backgroundColor: "rgba(232, 241, 237, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.3)",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  snoozeBtnText: {
    color: THEME.colors.cardTextPrimary,
    fontWeight: "bold",
    fontSize: 14,
  },
  dismissBtn: {
    flex: 1,
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  dismissBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  addModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.7)",
    justifyContent: "flex-end",
  },
  addModalCard: {
    backgroundColor: THEME.colors.cardBg,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    gap: 16,
  },
  addModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  addModalTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 18,
    fontWeight: "bold",
  },
  addInputGroup: {
    gap: 6,
  },
  addInputLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  addTextInput: {
    backgroundColor: "rgba(232, 241, 237, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.3)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: THEME.colors.cardTextPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  addSwitchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    maxWidth: "100%",
  },
  addSwitchTextContainer: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  addSwitchTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  addSwitchDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  createAlarmBtn: {
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },
  createAlarmBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
});
