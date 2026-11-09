import React, { memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
  Switch,
  Platform,
} from "react-native";
import {
  Smartphone,
  Timer,
  Sliders,
  X,
  CheckCircle2,
  RotateCw,
  AlertCircle,
  Zap,
  ChevronRight,
  Play,
  Pause,
  Wind,
  Check,
  Star,
  Moon,
  Clock,
} from "lucide-react-native";
import THEME from "@/constants/theme";
import {
  FOCUS_PRESETS,
  DISTRACTING_CATEGORIES,
  LiveFocusState,
  FocusSessionType,
} from "@/services/digitalWellbeingService";
import { FocusSessionRecord } from "@/services/db";

const triggerHaptic = (style?: string) => {
  if (Platform.OS === "web") return;
  try {
    const Haptics = require("expo-haptics");
    if (style === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {}
};

export interface ScreenTimeModalProps {
  visible: boolean;
  onClose: () => void;
  wellbeingTab: "usage" | "focus" | "limits";
  setWellbeingTab: (tab: "usage" | "focus" | "limits") => void;
  screenTelemetry: any;
  screenMinutesToday: number;
  screenLimitMinutes: number;
  setScreenLimitMinutes: (mins: number) => void;
  dynamicScreenScore: number;
  usagePermissionGranted: boolean | null;
  isScreenRefreshing: boolean;
  refreshScreenTime: () => void;
  requestUsagePermission: () => void;
  requestAccessibilityAndUsagePermission: () => void;
  openDndSettings: () => void;
  liveFocus: LiveFocusState;
  selectedFocusPreset: FocusSessionType;
  setSelectedFocusPreset: (preset: FocusSessionType) => void;
  selectedFocusMinutes: number;
  setSelectedFocusMinutes: (mins: number) => void;
  blockedCategories: string[];
  toggleCategoryBlock: (catId: string) => void;
  handleStartFocus: () => void;
  handlePauseFocus: () => void;
  handleResumeFocus: () => void;
  handleCancelFocus: () => void;
  handlePromptCompleteFocus: () => void;
  onOpenBreathing: () => void;
  todayFocusSessions: FocusSessionRecord[];
  windDownActive: boolean;
  setWindDownActive: (active: boolean) => void;
  bedtimeHour: string;
  wakeHour: string;
  dndAutoToggle: boolean;
  setDndAutoToggle: (val: boolean) => void;
  handleSaveWellbeing: () => void;
}

export const ScreenTimeModal = memo(function ScreenTimeModal({
  visible,
  onClose,
  wellbeingTab,
  setWellbeingTab,
  screenTelemetry,
  screenMinutesToday,
  screenLimitMinutes,
  setScreenLimitMinutes,
  dynamicScreenScore,
  usagePermissionGranted,
  isScreenRefreshing,
  refreshScreenTime,
  requestUsagePermission,
  requestAccessibilityAndUsagePermission,
  openDndSettings,
  liveFocus,
  selectedFocusPreset,
  setSelectedFocusPreset,
  selectedFocusMinutes,
  setSelectedFocusMinutes,
  blockedCategories,
  toggleCategoryBlock,
  handleStartFocus,
  handlePauseFocus,
  handleResumeFocus,
  handleCancelFocus,
  handlePromptCompleteFocus,
  onOpenBreathing,
  todayFocusSessions,
  windDownActive,
  setWindDownActive,
  bedtimeHour,
  wakeHour,
  dndAutoToggle,
  setDndAutoToggle,
  handleSaveWellbeing,
}: ScreenTimeModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalPanel, { maxHeight: "90%" }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                <Smartphone size={18} color="#a855f7" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Mindful Wellbeing & Focus</Text>
                <Text style={styles.modalSub}>Android telemetry & distraction shield</Text>
              </View>
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={onClose}>
              <X size={16} color="#0b1612" />
            </Pressable>
          </View>

          {/* Sub-navigation Tabs */}
          <View style={styles.wellbeingTabsRow}>
            <Pressable
              style={[styles.wellbeingTabBtn, wellbeingTab === "usage" && styles.wellbeingTabBtnActive]}
              onPress={() => {
                triggerHaptic();
                setWellbeingTab("usage");
              }}
            >
              <Smartphone size={13} color={wellbeingTab === "usage" ? "#ffffff" : "#244538"} />
              <Text style={[styles.wellbeingTabBtnText, wellbeingTab === "usage" && styles.wellbeingTabBtnTextActive]}>
                Usage
              </Text>
            </Pressable>

            <Pressable
              style={[styles.wellbeingTabBtn, wellbeingTab === "focus" && styles.wellbeingTabBtnActive]}
              onPress={() => {
                triggerHaptic();
                setWellbeingTab("focus");
              }}
            >
              <Timer size={13} color={wellbeingTab === "focus" ? "#ffffff" : "#244538"} />
              <Text style={[styles.wellbeingTabBtnText, wellbeingTab === "focus" && styles.wellbeingTabBtnTextActive]}>
                Focus Mode
              </Text>
              {liveFocus.isActive && (
                <View style={[styles.tabBadgeLiveDot, { backgroundColor: liveFocus.isPaused ? "#b45309" : "#047857" }]} />
              )}
            </Pressable>

            <Pressable
              style={[styles.wellbeingTabBtn, wellbeingTab === "limits" && styles.wellbeingTabBtnActive]}
              onPress={() => {
                triggerHaptic();
                setWellbeingTab("limits");
              }}
            >
              <Sliders size={13} color={wellbeingTab === "limits" ? "#ffffff" : "#244538"} />
              <Text style={[styles.wellbeingTabBtnText, wellbeingTab === "limits" && styles.wellbeingTabBtnTextActive]}>
                Wind Down
              </Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* TAB 1: USAGE & TELEMETRY */}
            {wellbeingTab === "usage" && (
              <View>
                {/* Today's Usage Banner */}
                <View style={styles.screenUsageCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.screenUsageLabel}>TODAY'S SCREEN TIME</Text>
                    {screenTelemetry.unlockCount > 0 && (
                      <Text style={{ fontSize: 11, color: THEME.colors.cardTextSecondary, fontWeight: "700" }}>
                        🔓 {screenTelemetry.unlockCount} Unlocks Today
                      </Text>
                    )}
                  </View>
                  <View style={styles.screenTimeLargeRow}>
                    <Text style={styles.screenTimeLarge}>
                      {Math.floor(screenMinutesToday / 60)}h {screenMinutesToday % 60}m
                    </Text>
                    <View
                      style={[
                        styles.screenStatusBadge,
                        screenMinutesToday === 0
                          ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }
                          : dynamicScreenScore >= 8.5
                          ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }
                          : { backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.3)" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.screenStatusBadgeText,
                          screenMinutesToday === 0
                            ? { color: "#10b981" }
                            : dynamicScreenScore >= 8.5
                            ? { color: "#10b981" }
                            : { color: "#ef4444" },
                        ]}
                      >
                        {screenMinutesToday === 0
                          ? "Standby • Ready"
                          : dynamicScreenScore >= 8.5
                          ? "Balanced"
                          : "Screen Heavy"}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar against limit */}
                  <View style={styles.screenBarTrack}>
                    <View
                      style={[
                        styles.screenBarFill,
                        {
                          width: `${Math.min(100, (screenMinutesToday / screenLimitMinutes) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={styles.screenLimitSub}>
                      Daily Target: {Math.floor(screenLimitMinutes / 60)}h {screenLimitMinutes % 60}m
                    </Text>
                    <Text style={[styles.screenLimitSub, { color: THEME.colors.cardTextSecondary, fontWeight: "700" }]}>
                      {Math.min(100, Math.round((screenMinutesToday / screenLimitMinutes) * 100))}% used
                    </Text>
                  </View>
                </View>

                {/* Android Native Permissions Center (Mindful Engine) */}
                {usagePermissionGranted ? (
                  <View style={[styles.permissionCard, { borderColor: "rgba(16, 185, 129, 0.35)", backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <CheckCircle2 size={17} color="#047857" />
                        <Text style={[styles.permissionTitle, { color: "#047857" }]}>Android UsageStats Active</Text>
                      </View>
                      <Pressable
                        style={styles.syncSmallBtn}
                        onPress={refreshScreenTime}
                        disabled={isScreenRefreshing}
                      >
                        <RotateCw size={11} color="#047857" />
                        <Text style={styles.syncSmallBtnText}>{isScreenRefreshing ? "Syncing..." : "Sync Live"}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.permissionDesc}>
                      Connected to Android UsageStatsManager. Reading live foreground screen time and app usage from your phone.
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.permissionCard, { borderColor: "rgba(245, 158, 11, 0.4)", backgroundColor: "rgba(245, 158, 11, 0.08)" }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <AlertCircle size={18} color="#b45309" />
                      <Text style={[styles.permissionTitle, { color: "#b45309" }]}>Usage Access Required</Text>
                    </View>
                    <Text style={styles.permissionDesc}>
                      Lumen needs Android Usage Access to read real screen time and show your installed app stats.
                    </Text>
                    <Pressable
                      style={[styles.permissionBtn, { backgroundColor: "#f59e0b" }]}
                      onPress={requestUsagePermission}
                    >
                      <Text style={[styles.permissionBtnText, { color: "#050b08" }]}>🛡️ Grant Usage Access (1-Tap)</Text>
                    </Pressable>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                      <Pressable
                        style={[styles.permissionBtnSecondary, { flex: 1 }]}
                        onPress={requestAccessibilityAndUsagePermission}
                      >
                        <Text style={styles.permissionBtnSecondaryText}>Guided Wizard</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.permissionBtnSecondary, { flex: 1 }]}
                        onPress={openDndSettings}
                      >
                        <Text style={styles.permissionBtnSecondaryText}>DND Policy</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* App Category Breakdown */}
                <Text style={styles.modalSectionLabel}>CATEGORY USAGE TELEMETRY</Text>
                {screenMinutesToday === 0 ? (
                  <View style={styles.emptyCategoryCard}>
                    <Text style={styles.emptyCategoryText}>
                      No screen time recorded yet today. Tap "Grant Usage Access" above to read actual phone stats.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.categoryList}>
                    {[
                      {
                        name: "💼 Productivity & Work",
                        min: screenTelemetry?.categories?.productivity?.minutes || 0,
                        pct: screenTelemetry?.categories?.productivity?.percentage || 0,
                        color: "#10b981",
                      },
                      {
                        name: "💬 Social & Messages",
                        min: screenTelemetry?.categories?.social?.minutes || 0,
                        pct: screenTelemetry?.categories?.social?.percentage || 0,
                        color: "#a855f7",
                      },
                      {
                        name: "🎬 Video & Media",
                        min: screenTelemetry?.categories?.entertainment?.minutes || 0,
                        pct: screenTelemetry?.categories?.entertainment?.percentage || 0,
                        color: "#38bdf8",
                      },
                      {
                        name: "🎮 Gaming & Arcade",
                        min: screenTelemetry?.categories?.gaming?.minutes || 0,
                        pct: screenTelemetry?.categories?.gaming?.percentage || 0,
                        color: "#ef4444",
                      },
                      {
                        name: "⚡ Other & Utilities",
                        min: screenTelemetry?.categories?.other?.minutes || 0,
                        pct: screenTelemetry?.categories?.other?.percentage || 0,
                        color: "#ec4899",
                      },
                    ].filter(c => c.min > 0 || c.pct > 0).map((cat, i) => (
                      <View key={i} style={{ marginBottom: 6 }}>
                        <View style={styles.categoryRow}>
                          <Text style={styles.categoryName}>{cat.name}</Text>
                          <Text style={[styles.categoryMins, { color: cat.color }]}>
                            {Math.floor(cat.min / 60)}h {cat.min % 60}m ({cat.pct}%)
                          </Text>
                        </View>
                        <View style={[styles.screenBarTrack, { height: 4, marginTop: 4 }]}>
                          <View style={[styles.screenBarFill, { width: `${cat.pct}%`, backgroundColor: cat.color, height: 4 }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Real Device Apps Telemetry (Mindful Engine) */}
                {screenTelemetry?.apps && screenTelemetry.apps.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={styles.modalSectionLabel}>TOP APPS USED TODAY</Text>
                    <View style={{ gap: 8 }}>
                      {screenTelemetry.apps.slice(0, 10).map((app: any, i: number) => (
                        <View key={app.packageName || i} style={styles.realAppRow}>
                          {app.icon ? (
                            <Image source={{ uri: app.icon }} style={styles.realAppIcon} />
                          ) : (
                            <View style={styles.realAppIconPlaceholder}>
                              <Text style={styles.realAppIconInitial}>{app.appName.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                              <Text style={styles.realAppName} numberOfLines={1}>{app.appName}</Text>
                              <Text style={styles.realAppTime}>
                                {Math.floor(app.screenMinutes / 60) > 0 ? `${Math.floor(app.screenMinutes / 60)}h ` : ""}
                                {app.screenMinutes % 60}m
                              </Text>
                            </View>
                            <View style={styles.realAppTrack}>
                              <View
                                style={[
                                  styles.realAppFill,
                                  {
                                    width: `${Math.min(100, Math.max(4, (app.screenMinutes / (screenTelemetry.totalScreenMinutes || 1)) * 100))}%`,
                                    backgroundColor:
                                      app.category === "productivity"
                                        ? "#10b981"
                                        : app.category === "social"
                                        ? "#a855f7"
                                        : app.category === "entertainment"
                                        ? "#38bdf8"
                                        : app.category === "gaming"
                                        ? "#ef4444"
                                        : "#94a3b8",
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Quick Action to switch to Focus Mode */}
                <Pressable
                  style={styles.quickFocusBanner}
                  onPress={() => {
                    triggerHaptic();
                    setWellbeingTab("focus");
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={styles.quickFocusIconBox}>
                      <Zap size={16} color="#10b981" />
                    </View>
                    <View>
                      <Text style={styles.quickFocusTitle}>Ready for Deep Work?</Text>
                      <Text style={styles.quickFocusSub}>Start a Focus Mode session to shield distractions</Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color="#244538" />
                </Pressable>
              </View>
            )}

            {/* TAB 2: FOCUS MODE & POMODORO */}
            {wellbeingTab === "focus" && (
              <View>
                {liveFocus.isActive ? (
                  /* Active Focus Session Countdown HUD */
                  <View style={styles.activeFocusBox}>
                    <View style={styles.activeFocusHeaderRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={[styles.pulsingDot, { backgroundColor: liveFocus.isPaused ? "#f59e0b" : "#10b981" }]} />
                        <Text style={styles.activeFocusTypeTitle}>
                          {liveFocus.sessionType.toUpperCase().replace("_", " ")}
                        </Text>
                      </View>
                      <Text style={styles.activeFocusPercentText}>
                        {liveFocus.progressPercent}% DONE
                      </Text>
                    </View>

                    {/* Large Digital Clock readout */}
                    <View style={styles.bigFocusClockContainer}>
                      <Text style={styles.bigFocusClockDigits}>
                        {Math.floor(liveFocus.remainingSeconds / 60).toString().padStart(2, "0")}:
                        {(liveFocus.remainingSeconds % 60).toString().padStart(2, "0")}
                      </Text>
                      <Text style={styles.bigFocusClockSub}>
                        {liveFocus.isPaused ? "Session Paused • Take a Breath" : "Focus Flow In Progress"}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    <View style={[styles.screenBarTrack, { height: 8, marginTop: 4, marginBottom: 14 }]}>
                      <View
                        style={[
                          styles.screenBarFill,
                          {
                            width: `${liveFocus.progressPercent}%`,
                            backgroundColor: liveFocus.isPaused ? "#f59e0b" : "#10b981",
                            height: 8,
                          },
                        ]}
                      />
                    </View>

                    {/* Mindful Quote Banner */}
                    <View style={styles.quoteCard}>
                      <Text style={styles.quoteText}>"{liveFocus.currentQuote?.text || "Stay present in this moment."}"</Text>
                      <Text style={styles.quoteAuthor}>— {liveFocus.currentQuote?.author || "Mindful OS"}</Text>
                    </View>

                    {/* Control buttons */}
                    <View style={{ gap: 10, marginTop: 14 }}>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        {liveFocus.isPaused ? (
                          <Pressable
                            style={[styles.focusActionBtn, { backgroundColor: "#10b981", flex: 1 }]}
                            onPress={handleResumeFocus}
                          >
                            <Play size={16} color="#050b08" />
                            <Text style={styles.focusActionBtnText}>Resume</Text>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={[styles.focusActionBtn, { backgroundColor: "#f59e0b", flex: 1 }]}
                            onPress={handlePauseFocus}
                          >
                            <Pause size={16} color="#050b08" />
                            <Text style={styles.focusActionBtnText}>Pause</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={[styles.focusActionBtnSecondary, { flex: 1 }]}
                          onPress={onOpenBreathing}
                        >
                          <Wind size={15} color="#38bdf8" />
                          <Text style={styles.focusActionBtnSecondaryText}>Breathe (60s)</Text>
                        </Pressable>
                      </View>

                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <Pressable
                          style={[styles.focusCompleteBtn, { flex: 1 }]}
                          onPress={handlePromptCompleteFocus}
                        >
                          <Check size={16} color="#10b981" />
                          <Text style={styles.focusCompleteBtnText}>Finish & Log</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.focusCancelBtn, { flex: 1 }]}
                          onPress={handleCancelFocus}
                        >
                          <X size={16} color="#ef4444" />
                          <Text style={styles.focusCancelBtnText}>End Early</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ) : (
                  /* Inactive: Setup New Focus Session */
                  <View>
                    <Text style={styles.modalSectionLabel}>CHOOSE FOCUS INTERVAL</Text>
                    <View style={styles.presetGrid}>
                      {FOCUS_PRESETS.map((p) => {
                        const isSelected = selectedFocusPreset === p.type;
                        return (
                          <Pressable
                            key={p.type}
                            style={[
                              styles.presetCard,
                              isSelected && { borderColor: p.accentColor, backgroundColor: "rgba(16, 185, 129, 0.08)" },
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setSelectedFocusPreset(p.type);
                              setSelectedFocusMinutes(p.minutes);
                            }}
                          >
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                              <Text style={[styles.presetCardTitle, isSelected && { color: p.accentColor }]}>
                                {p.title}
                              </Text>
                              <View style={[styles.presetMinutesPill, { backgroundColor: `${p.accentColor}25` }]}>
                                <Text style={[styles.presetMinutesText, { color: p.accentColor }]}>
                                  {p.minutes}m
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.presetCardDesc}>{p.description}</Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Distracting App Categories Shield */}
                    <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                      DISTRACTION SHIELD (BLOCKLIST)
                    </Text>
                    <View style={styles.distractionList}>
                      {DISTRACTING_CATEGORIES.map((cat) => {
                        const isBlocked = blockedCategories.includes(cat.id);
                        return (
                          <Pressable
                            key={cat.id}
                            style={[styles.distractionRow, isBlocked && styles.distractionRowActive]}
                            onPress={() => toggleCategoryBlock(cat.id)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.distractionName, isBlocked && { color: "#047857", fontWeight: "800" }]}>
                                {cat.name}
                              </Text>
                              <Text style={styles.distractionDesc}>{cat.description}</Text>
                            </View>
                            <View
                              style={[
                                styles.checkboxBox,
                                isBlocked && { backgroundColor: "#047857", borderColor: "#047857" },
                              ]}
                            >
                              {isBlocked && <Check size={12} color="#ffffff" />}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Mindful Quote Banner */}
                    <View style={[styles.quoteCard, { marginTop: 12 }]}>
                      <Text style={styles.quoteText}>
                        "Clarity about what matters provides clarity about what does not."
                      </Text>
                      <Text style={styles.quoteAuthor}>— Cal Newport</Text>
                    </View>

                    {/* Start Focus Button */}
                    <Pressable
                      style={[styles.modalPrimaryBtn, { backgroundColor: THEME.colors.accentTeal, marginTop: 16 }]}
                      onPress={handleStartFocus}
                    >
                      <Zap size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.modalPrimaryBtnText}>
                        Start {selectedFocusMinutes}m Focus Session
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Session History Log */}
                {todayFocusSessions && todayFocusSessions.length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.modalSectionLabel}>TODAY'S COMPLETED SESSIONS</Text>
                    <View style={styles.historyList}>
                      {todayFocusSessions.map((s, idx) => (
                        <View key={s.id || idx} style={styles.historyRow}>
                          <View>
                            <Text style={styles.historyTitle}>
                              {s.sessionType.toUpperCase().replace("_", " ")} ({s.targetMinutes}m)
                            </Text>
                            <Text style={styles.historySub}>
                              {s.reflectionNote ? `Note: ${s.reflectionNote}` : "Completed cleanly"}
                            </Text>
                          </View>
                          <View style={styles.starRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                color={(s.reflectionScore || 5) >= star ? "#f59e0b" : "#334155"}
                                fill={(s.reflectionScore || 5) >= star ? "#f59e0b" : "transparent"}
                              />
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: LIMITS & WIND DOWN ROUTINE */}
            {wellbeingTab === "limits" && (
              <View>
                {/* Daily Target Limit Selector */}
                <Text style={styles.modalSectionLabel}>DAILY SCREEN LIMIT</Text>
                <View style={styles.hoursChipsRow}>
                  {[120, 180, 240, 300, 360].map((mins) => {
                    const isSelected = screenLimitMinutes === mins;
                    return (
                      <Pressable
                        key={mins}
                        style={[styles.hoursChip, isSelected && styles.hoursChipActive]}
                        onPress={() => {
                          triggerHaptic();
                          setScreenLimitMinutes(mins);
                        }}
                      >
                        <Text style={[styles.hoursChipText, isSelected && styles.hoursChipTextActive]}>
                          {mins / 60}h limit
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Bedtime Wind Down Routine */}
                <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>BEDTIME WIND DOWN</Text>
                <View style={styles.wellbeingSwitchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Bedtime Routine</Text>
                    <Text style={styles.switchDesc}>Mute alerts 30m before sleep to boost REM recovery</Text>
                  </View>
                  <Switch
                    value={windDownActive}
                    onValueChange={(val) => {
                      triggerHaptic();
                      setWindDownActive(val);
                    }}
                    trackColor={{ false: "#1e293b", true: "#38bdf8" }}
                    thumbColor={windDownActive ? "#050b08" : "#94a3b8"}
                  />
                </View>

                {/* Bedtime & Wakeup Hours Display */}
                <View style={styles.bedtimeHoursRow}>
                  <View style={styles.bedtimeBox}>
                    <Moon size={16} color="#38bdf8" />
                    <Text style={styles.bedtimeLabel}>Bedtime Target</Text>
                    <Text style={styles.bedtimeVal}>{bedtimeHour} PM</Text>
                  </View>
                  <View style={styles.bedtimeBox}>
                    <Clock size={16} color="#10b981" />
                    <Text style={styles.bedtimeLabel}>Wake Up Target</Text>
                    <Text style={styles.bedtimeVal}>{wakeHour} AM</Text>
                  </View>
                </View>

                {/* Auto DND Toggle */}
                <View style={styles.wellbeingSwitchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Auto DND During Sleep</Text>
                    <Text style={styles.switchDesc}>Silence non-starred phone notifications</Text>
                  </View>
                  <Switch
                    value={dndAutoToggle}
                    onValueChange={(val) => {
                      triggerHaptic();
                      setDndAutoToggle(val);
                    }}
                    trackColor={{ false: "#1e293b", true: "#a855f7" }}
                    thumbColor={dndAutoToggle ? "#050b08" : "#94a3b8"}
                  />
                </View>

                {/* Save Button */}
                <Pressable
                  style={[styles.modalPrimaryBtn, { marginTop: 16 }]}
                  onPress={handleSaveWellbeing}
                >
                  <Check size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalPrimaryBtnText}>Save Wellbeing Settings</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalPanel: {
    backgroundColor: THEME.colors.cardBgSolid,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  modalSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(11, 22, 18, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 22, 18, 0.12)",
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  wellbeingTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  wellbeingTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(11, 22, 18, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(11, 22, 18, 0.12)",
  },
  wellbeingTabBtnActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  wellbeingTabBtnText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  wellbeingTabBtnTextActive: {
    color: "#ffffff",
  },
  tabBadgeLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  screenUsageCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 14,
  },
  screenUsageLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 1,
  },
  screenTimeLargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  screenTimeLarge: {
    fontSize: 26,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  screenStatusBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  screenStatusBadgeText: {
    color: "#a855f7",
    fontSize: 11,
    fontWeight: "700",
  },
  screenBarTrack: {
    height: 6,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 3,
    marginTop: 12,
    overflow: "hidden",
  },
  screenBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#a855f7",
  },
  screenLimitSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 6,
    fontWeight: "600",
  },
  permissionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginBottom: 14,
  },
  permissionTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  permissionDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 6,
    marginBottom: 10,
  },
  permissionBtn: {
    backgroundColor: "#a855f7",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  permissionBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  permissionBtnSecondary: {
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  permissionBtnSecondaryText: {
    color: "#7e22ce",
    fontSize: 11,
    fontWeight: "800",
  },
  syncSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(4, 120, 87, 0.12)",
  },
  syncSmallBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
  },
  emptyCategoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginBottom: 10,
    alignItems: "center",
  },
  emptyCategoryText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "600",
  },
  categoryList: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryMins: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  realAppRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  realAppIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  realAppIconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  realAppIconInitial: {
    fontSize: 14,
    fontWeight: "800",
    color: "#475569",
  },
  realAppName: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
    flex: 1,
  },
  realAppTime: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    marginLeft: 8,
  },
  realAppTrack: {
    height: 4,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  realAppFill: {
    height: 4,
    borderRadius: 2,
  },
  quickFocusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  quickFocusIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickFocusTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  quickFocusSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  activeFocusBox: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  activeFocusHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeFocusTypeTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  activeFocusPercentText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  bigFocusClockContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  bigFocusClockDigits: {
    fontSize: 54,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  bigFocusClockSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  quoteCard: {
    backgroundColor: THEME.colors.cardBg,
    borderLeftWidth: 3,
    borderLeftColor: "#10b981",
    borderRadius: 24,
    padding: 12,
  },
  quoteText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
  quoteAuthor: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "right",
  },
  focusActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  focusActionBtnText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "800",
  },
  focusActionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  focusActionBtnSecondaryText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "700",
  },
  focusCompleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  focusCompleteBtnText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
  },
  focusCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  focusCancelBtnText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },
  presetGrid: {
    gap: 8,
  },
  presetCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
  },
  presetCardTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  presetMinutesPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  presetMinutesText: {
    fontSize: 11,
    fontWeight: "800",
  },
  presetCardDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  distractionList: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    gap: 6,
  },
  distractionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  distractionRowActive: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  distractionName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12.5,
    fontWeight: "700",
  },
  distractionDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10.5,
    marginTop: 2,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  historyList: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.35)",
  },
  historyTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  historySub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  starRow: {
    flexDirection: "row",
    gap: 2,
  },
  hoursChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  hoursChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  hoursChipActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  hoursChipText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  hoursChipTextActive: {
    color: "#ffffff",
  },
  wellbeingSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginTop: 8,
    marginBottom: 4,
  },
  switchTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  switchDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  bedtimeHoursRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  bedtimeBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    alignItems: "center",
    gap: 4,
  },
  bedtimeLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bedtimeVal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  modalPrimaryBtn: {
    flexDirection: "row",
    backgroundColor: THEME.colors.accentTeal,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
