import React, { useState, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import {
  Droplet,
  X,
  Sparkles,
  Bell,
  Zap,
  Sliders,
  Clock,
  Trash2,
  Info,
} from "lucide-react-native";
import THEME from "@/constants/theme";
import { HydrationState } from "@/services/hydrationService";

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

export interface HydrationModalProps {
  visible: boolean;
  onClose: () => void;
  hydration: HydrationState;
  selectedBeverage: string;
  setSelectedBeverage: (bev: string) => void;
  logDrink: (amountMl: number, beverageType?: string) => Promise<any>;
  decrementWater: () => Promise<any>;
  removeEntry: (id: string) => Promise<any>;
  toggleReminders: (enabled: boolean) => Promise<any>;
  setIntervalHours: (hours: number) => Promise<any>;
  sendTestPrompt: () => Promise<any>;
  hydrationPresets: any[];
  hydrationBeverageTypes: Record<string, any>;
  hydrationSchedule: any[];
}

export const HydrationModal = memo(function HydrationModal({
  visible,
  onClose,
  hydration,
  selectedBeverage,
  setSelectedBeverage,
  logDrink,
  decrementWater,
  removeEntry,
  toggleReminders,
  setIntervalHours,
  sendTestPrompt,
  hydrationPresets,
  hydrationBeverageTypes,
  hydrationSchedule,
}: HydrationModalProps) {
  const [hydrationModalTab, setHydrationModalTab] = useState<"overview" | "roadmap" | "urine">("overview");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalPanel, { maxHeight: "90%" }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.hydrationHeaderIcon}>
                  <Droplet size={18} color="#06b6d4" />
                </View>
                <Text style={styles.modalTitle}>Cellular Hydration Hub</Text>
              </View>
              <Text style={styles.modalSub}>
                Dynamic Target: {hydration.targetMl.toLocaleString()} ml • {hydration.targetCups} cups
              </Text>
            </View>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => {
                triggerHaptic();
                onClose();
              }}
            >
              <X size={18} color="#0b1612" />
            </Pressable>
          </View>

          {/* Segmented Navigation Tabs */}
          <View style={styles.hydrationTabsRow}>
            <Pressable
              style={[
                styles.hydrationTabBtn,
                hydrationModalTab === "overview" && styles.hydrationTabBtnActive,
              ]}
              onPress={() => {
                triggerHaptic();
                setHydrationModalTab("overview");
              }}
            >
              <Text
                style={[
                  styles.hydrationTabBtnText,
                  hydrationModalTab === "overview" && styles.hydrationTabBtnTextActive,
                ]}
              >
                Overview & Log
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.hydrationTabBtn,
                hydrationModalTab === "roadmap" && styles.hydrationTabBtnActive,
              ]}
              onPress={() => {
                triggerHaptic();
                setHydrationModalTab("roadmap");
              }}
            >
              <Text
                style={[
                  styles.hydrationTabBtnText,
                  hydrationModalTab === "roadmap" && styles.hydrationTabBtnTextActive,
                ]}
              >
                Hourly Roadmap
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.hydrationTabBtn,
                hydrationModalTab === "urine" && styles.hydrationTabBtnActive,
              ]}
              onPress={() => {
                triggerHaptic();
                setHydrationModalTab("urine");
              }}
            >
              <Text
                style={[
                  styles.hydrationTabBtnText,
                  hydrationModalTab === "urine" && styles.hydrationTabBtnTextActive,
                ]}
              >
                Clinical Guide
              </Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
            {/* TAB 1: OVERVIEW & QUICK LOG */}
            {hydrationModalTab === "overview" && (
              <View style={{ gap: 16 }}>
                {/* HERO RESERVOIR CARD */}
                <View style={styles.reservoirHeroCard}>
                  <View style={styles.reservoirRow}>
                    <View style={styles.reservoirLeftCol}>
                      <Text style={styles.reservoirPercent}>{hydration.percentUsed}%</Text>
                      <Text style={styles.reservoirSubtitle}>OF DAILY TARGET</Text>
                      <View
                        style={[
                          styles.reservoirBadgePill,
                          {
                            backgroundColor: `${hydration.statusBadgeColor}22`,
                            borderColor: `${hydration.statusBadgeColor}55`,
                          },
                        ]}
                      >
                        <Text style={[styles.reservoirBadgeText, { color: hydration.statusBadgeColor }]}>
                          {hydration.statusLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.reservoirRightCol}>
                      <Text style={styles.reservoirBigMl}>
                        {hydration.todayMl.toLocaleString()}
                        <Text style={styles.reservoirMlUnit}> ml</Text>
                      </Text>
                      <Text style={styles.reservoirCupsCount}>
                        {hydration.todayCups.toFixed(1)} / {hydration.targetCups} cups logged
                      </Text>
                      <View style={styles.reservoirMetaBox}>
                        <Sparkles size={12} color="#06b6d4" />
                        <Text style={styles.reservoirMetaText}>
                          Base 2,000ml + {Math.max(0, hydration.targetMl - 2000)}ml active burn
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Fluid Gauge Bar */}
                  <View style={styles.reservoirGaugeTrack}>
                    <View
                      style={[
                        styles.reservoirGaugeFill,
                        {
                          width: `${Math.min(100, (hydration.todayMl / (hydration.targetMl || 2000)) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Quick Reminder Strip */}
                <Pressable
                  style={styles.hydrationQuickStrip}
                  onPress={() => {
                    triggerHaptic();
                    setHydrationModalTab("roadmap");
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Bell size={14} color={hydration.remindersEnabled ? "#0891b2" : "#94a3b8"} />
                    <Text style={styles.hydrationQuickStripText}>
                      {hydration.remindersEnabled
                        ? `Hydration Nudges: ${hydration.nextPromptTimeStr || `Every ${hydration.reminderIntervalHours}h`}`
                        : "Hydration Nudges: Disabled"}
                    </Text>
                  </View>
                  <Text style={styles.hydrationQuickStripAction}>Adjust ➔</Text>
                </Pressable>

                {/* ACTIVE BEVERAGE TYPE SELECTOR */}
                <View style={styles.hydrationSectionBox}>
                  <View style={styles.hydrationSectionHeader}>
                    <Droplet size={14} color="#06b6d4" />
                    <Text style={styles.hydrationSectionTitle}>Selected Beverage Type</Text>
                  </View>
                  <View style={styles.beverageChipsRow}>
                    {Object.values(hydrationBeverageTypes).map((bev: any) => {
                      const isSelected = selectedBeverage === bev.id;
                      return (
                        <Pressable
                          key={bev.id}
                          style={[
                            styles.beverageChip,
                            isSelected && {
                              borderColor: bev.color,
                              backgroundColor: `${bev.color}1a`,
                            },
                          ]}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedBeverage(bev.id);
                          }}
                        >
                          <Text style={styles.beverageChipIcon}>{bev.icon}</Text>
                          <View>
                            <Text
                              style={[
                                styles.beverageChipName,
                                isSelected && { color: bev.color, fontWeight: "800" },
                              ]}
                            >
                              {bev.name}
                            </Text>
                            <Text style={styles.beverageChipFactor}>
                              {bev.hydrationFactor}x factor
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* QUICK CONTAINER PRESETS (6 TILES) */}
                <View style={styles.hydrationSectionBox}>
                  <View style={styles.hydrationSectionHeader}>
                    <Zap size={14} color="#10b981" />
                    <Text style={styles.hydrationSectionTitle}>Quick Container Presets</Text>
                  </View>
                  <View style={styles.containerPresetsGrid}>
                    {hydrationPresets.map((preset: any) => (
                      <Pressable
                        key={preset.id}
                        style={styles.containerPresetCard}
                        onPress={() => {
                          logDrink(preset.amountMl, selectedBeverage);
                        }}
                      >
                        <Text style={styles.presetIcon}>{preset.icon}</Text>
                        <Text style={styles.presetLabel} numberOfLines={1}>
                          {preset.label}
                        </Text>
                        <View
                          style={[
                            styles.presetBadge,
                            { backgroundColor: `${preset.color}20`, borderColor: `${preset.color}40` },
                          ]}
                        >
                          <Text style={[styles.presetBadgeText, { color: preset.color }]}>
                            +{preset.amountMl} ml
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* INTERACTIVE 10-CUP MATRIX */}
                <View style={styles.hydrationSectionBox}>
                  <View style={styles.hydrationSectionHeader}>
                    <Droplet size={14} color="#38bdf8" />
                    <Text style={styles.hydrationSectionTitle}>Interactive Cups Matrix</Text>
                    <Text style={styles.cupMatrixCount}>
                      ({Math.round(hydration.todayCups)} / 10 cups)
                    </Text>
                  </View>
                  <View style={styles.cupsMatrixGrid}>
                    {Array.from({ length: 10 }).map((_, idx) => {
                      const isFilled = idx < Math.floor(hydration.todayCups);
                      return (
                        <Pressable
                          key={idx}
                          style={[
                            styles.cupMatrixItem,
                            isFilled && styles.cupMatrixItemFilled,
                          ]}
                          onPress={() => {
                            if (isFilled && idx === Math.floor(hydration.todayCups) - 1) {
                              decrementWater();
                            } else {
                              logDrink(250, selectedBeverage);
                            }
                          }}
                        >
                          <Droplet
                            size={20}
                            color={isFilled ? "#06b6d4" : "#334155"}
                            fill={isFilled ? "#06b6d4" : "transparent"}
                          />
                          <Text
                            style={[
                              styles.cupMatrixIndex,
                              isFilled && { color: "#06b6d4", fontWeight: "800" },
                            ]}
                          >
                            {idx + 1}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* CUSTOM INTAKE VOLUME LOGGER */}
                <View style={styles.hydrationSectionBox}>
                  <View style={styles.hydrationSectionHeader}>
                    <Sliders size={14} color="#f59e0b" />
                    <Text style={styles.hydrationSectionTitle}>Custom Volume Intake</Text>
                  </View>
                  <View style={styles.customIntakeRow}>
                    {[100, 200, 300, 500].map((vol) => (
                      <Pressable
                        key={vol}
                        style={styles.customVolChip}
                        onPress={() => logDrink(vol, selectedBeverage)}
                      >
                        <Text style={styles.customVolText}>+{vol} ml</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* TODAY'S INTAKE HISTORY LOG */}
                <View style={styles.hydrationSectionBox}>
                  <View style={styles.hydrationSectionHeader}>
                    <Clock size={14} color="#a855f7" />
                    <Text style={styles.hydrationSectionTitle}>Today's Logged Intakes</Text>
                    <Text style={styles.cupMatrixCount}>
                      ({hydration.entries.length} entries)
                    </Text>
                  </View>

                  {hydration.entries.length === 0 ? (
                    <View style={styles.hydrationEmptyBox}>
                      <Text style={styles.hydrationEmptyText}>
                        No entries logged yet today. Tap any container or cup above to start!
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {hydration.entries.slice().reverse().map((entry: any) => {
                        const bev = hydrationBeverageTypes[entry.beverageType || "water"] || {
                          name: "Water",
                          icon: "💧",
                          color: "#06b6d4",
                        };
                        const timeStr = entry.loggedAt
                          ? new Date(entry.loggedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Just now";

                        return (
                          <View key={entry.id} style={styles.hydrationEntryRow}>
                            <View style={styles.hydrationEntryLeft}>
                              <Text style={styles.hydrationEntryIcon}>{bev.icon}</Text>
                              <View>
                                <Text style={styles.hydrationEntryName}>{bev.name}</Text>
                                <Text style={styles.hydrationEntryTime}>{timeStr}</Text>
                              </View>
                            </View>

                            <View style={styles.hydrationEntryRight}>
                              <Text style={styles.hydrationEntryAmount}>
                                +{entry.amountMl} ml
                              </Text>
                              <Pressable
                                style={styles.hydrationDeleteBtn}
                                onPress={() => removeEntry(entry.id)}
                              >
                                <Trash2 size={14} color="#ef4444" />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* TAB 2: HOURLY ROADMAP */}
            {hydrationModalTab === "roadmap" && (
              <View style={{ gap: 12 }}>
                <View style={styles.roadmapIntroBox}>
                  <Info size={16} color="#38bdf8" />
                  <Text style={styles.roadmapIntroText}>
                    Circadian fluid intake sustains cognitive peak without midnight sleep interruptions.
                  </Text>
                </View>

                {/* HYDRATION SMART PROMPTS CONTROL CENTER */}
                <View style={styles.hydrationStationCard}>
                  <View style={styles.hydrationStationHeader}>
                    <View style={styles.hydrationStationIconBox}>
                      <Droplet size={18} color="#0891b2" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.hydrationStationTitle}>Smart Daytime Reminders</Text>
                        <View
                          style={[
                            styles.hydrationStationBadge,
                            {
                              backgroundColor: hydration.remindersEnabled
                                ? "rgba(8, 145, 178, 0.15)"
                                : "rgba(100, 116, 139, 0.15)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.hydrationStationBadgeText,
                              {
                                color: hydration.remindersEnabled ? "#0891b2" : "#64748b",
                              },
                            ]}
                          >
                            {hydration.remindersEnabled ? "ACTIVE (AUTO)" : "OFF"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.hydrationStationSub}>
                        Gentle periodic nudges calculated for optimal cellular absorption
                      </Text>
                    </View>

                    <Pressable
                      style={styles.hydrationStationToggle}
                      onPress={() => toggleReminders(!hydration.remindersEnabled)}
                    >
                      <View
                        style={[
                          styles.togglePill,
                          hydration.remindersEnabled && styles.togglePillActive,
                        ]}
                      >
                        <View
                          style={[
                            styles.toggleKnob,
                            hydration.remindersEnabled && styles.toggleKnobActive,
                          ]}
                        />
                      </View>
                    </Pressable>
                  </View>

                  {/* Frequency Selector */}
                  {hydration.remindersEnabled && (
                    <View style={styles.hydrationStationBody}>
                      <Text style={styles.hydrationStationLabel}>NUDGE INTERVAL FREQUENCY</Text>
                      <View style={styles.hydrationStationIntervalRow}>
                        {[
                          { label: "Every 1h", val: 1 },
                          { label: "Every 1.5h", val: 1.5 },
                          { label: "Every 2h", val: 2 },
                          { label: "Every 3h", val: 3 },
                        ].map((chip) => {
                          const isSelected = hydration.reminderIntervalHours === chip.val;
                          return (
                            <Pressable
                              key={chip.val}
                              style={[
                                styles.hydrationStationChip,
                                isSelected && styles.hydrationStationChipActive,
                              ]}
                              onPress={() => setIntervalHours(chip.val)}
                            >
                              <Text
                                style={[
                                  styles.hydrationStationChipText,
                                  isSelected && styles.hydrationStationChipTextActive,
                                ]}
                              >
                                {chip.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <View style={styles.hydrationStationFooter}>
                        <Text style={styles.hydrationStationSyncNotice}>
                          ⚡ Synced with Android AlarmManager & Reminders
                        </Text>
                        <Pressable
                          style={styles.hydrationStationTestBtn}
                          onPress={async () => {
                            await sendTestPrompt();
                            Alert.alert("💧 Test Prompt Sent", "Check your phone notifications bar!");
                          }}
                        >
                          <Bell size={12} color="#0891b2" />
                          <Text style={styles.hydrationStationTestBtnText}>Test Nudge</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>

                {hydrationSchedule.map((slot: any, sIdx: number) => (
                  <View key={sIdx} style={styles.roadmapSlotCard}>
                    <View style={styles.roadmapSlotHeader}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Clock size={14} color="#06b6d4" />
                        <Text style={styles.roadmapTime}>{slot.timeWindow}</Text>
                      </View>
                      <View style={styles.roadmapMlBadge}>
                        <Text style={styles.roadmapMlText}>{slot.recommendedMl} ml</Text>
                      </View>
                    </View>
                    <Text style={styles.roadmapPeriodName}>{slot.periodName}</Text>
                    <Text style={styles.roadmapPurpose}>{slot.purpose}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* TAB 3: CLINICAL URINE GUIDE */}
            {hydrationModalTab === "urine" && (
              <View style={{ gap: 12 }}>
                <View style={styles.roadmapIntroBox}>
                  <Info size={16} color="#10b981" />
                  <Text style={styles.roadmapIntroText}>
                    Clinical hydration monitoring scale based on metabolic solute concentration.
                  </Text>
                </View>

                {[
                  {
                    level: "Level 1: Pale Straw / Lemon",
                    color: "#fef08a",
                    badge: "Optimal",
                    badgeColor: "#047857",
                    description: "Ideal intracellular hydration equilibrium. Maintain normal sipping pace.",
                  },
                  {
                    level: "Level 2: Completely Clear",
                    color: "#f8fafc",
                    badge: "High Hydration",
                    badgeColor: "#0891b2",
                    description: "High fluid volume. Supplement with electrolytes to prevent sodium flushing.",
                  },
                  {
                    level: "Level 3: Light Golden Yellow",
                    color: "#fde047",
                    badge: "Good",
                    badgeColor: "#4d7c0f",
                    description: "Healthy range. Drink 1 glass (250 ml) within the next hour.",
                  },
                  {
                    level: "Level 4: Dark Amber / Honey",
                    color: "#eab308",
                    badge: "Dehydrated",
                    badgeColor: "#b45309",
                    description: "Cellular deficit. Drink 500 ml immediately and reduce caffeine intake.",
                  },
                  {
                    level: "Level 5: Tea Brown / Dark Copper",
                    color: "#b45309",
                    badge: "Critical Deficit",
                    badgeColor: "#b91c1c",
                    description: "Severe dehydration or high sweat loss. Rehydrate with electrolytes urgently.",
                  },
                ].map((guide, gIdx) => (
                  <View key={gIdx} style={styles.urineGuideCard}>
                    <View style={styles.urineGuideTop}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View
                          style={[
                            styles.urineColorSwatch,
                            { backgroundColor: guide.color },
                          ]}
                        />
                        <Text style={styles.urineGuideTitle}>{guide.level}</Text>
                      </View>
                      <View
                        style={[
                          styles.urineStatusBadge,
                          { backgroundColor: `${guide.badgeColor}20`, borderColor: `${guide.badgeColor}40` },
                        ]}
                      >
                        <Text style={[styles.urineStatusText, { color: guide.badgeColor }]}>
                          {guide.badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.urineGuideDesc}>{guide.description}</Text>
                  </View>
                ))}
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
  hydrationHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(8, 145, 178, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationTabsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(11, 22, 18, 0.06)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  hydrationTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationTabBtnActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderWidth: 1,
    borderColor: THEME.colors.accentTeal,
  },
  hydrationTabBtnText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationTabBtnTextActive: {
    color: "#ffffff",
  },
  reservoirHeroCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  reservoirRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  reservoirLeftCol: {
    flex: 1,
  },
  reservoirPercent: {
    fontSize: 34,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  reservoirSubtitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 6,
  },
  reservoirBadgePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  reservoirBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reservoirRightCol: {
    alignItems: "flex-end",
  },
  reservoirBigMl: {
    fontSize: 26,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  reservoirMlUnit: {
    fontSize: 14,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "700",
  },
  reservoirCupsCount: {
    fontSize: 12,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  reservoirMetaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  reservoirMetaText: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
  },
  reservoirGaugeTrack: {
    height: 8,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 4,
    overflow: "hidden",
  },
  reservoirGaugeFill: {
    height: 8,
    backgroundColor: "#0891b2",
    borderRadius: 4,
  },
  hydrationQuickStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(8, 145, 178, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  hydrationQuickStripText: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationQuickStripAction: {
    color: "#0891b2",
    fontSize: 11,
    fontWeight: "800",
  },
  hydrationSectionBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  hydrationSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  hydrationSectionTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  beverageChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  beverageChip: {
    flex: 1,
    minWidth: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  beverageChipIcon: {
    fontSize: 20,
  },
  beverageChipName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  beverageChipFactor: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  containerPresetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  containerPresetCard: {
    width: "31%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  presetIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  presetLabel: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  presetBadge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cupMatrixCount: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: "auto",
  },
  cupsMatrixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  cupMatrixItem: {
    width: "18%",
    aspectRatio: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  cupMatrixItemFilled: {
    backgroundColor: "rgba(8, 145, 178, 0.15)",
    borderColor: "rgba(8, 145, 178, 0.4)",
  },
  cupMatrixIndex: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  customIntakeRow: {
    flexDirection: "row",
    gap: 8,
  },
  customVolChip: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  customVolText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationEmptyBox: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationEmptyText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  hydrationEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  hydrationEntryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hydrationEntryIcon: {
    fontSize: 18,
  },
  hydrationEntryName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationEntryTime: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    marginTop: 1,
    fontWeight: "600",
  },
  hydrationEntryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hydrationEntryAmount: {
    color: "#0891b2",
    fontSize: 13,
    fontWeight: "800",
  },
  hydrationDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationStationCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
    padding: 16,
    marginBottom: 6,
    ...THEME.shadows.card,
  },
  hydrationStationHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  hydrationStationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(8, 145, 178, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationStationTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  hydrationStationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hydrationStationBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  hydrationStationSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  hydrationStationToggle: {
    padding: 4,
  },
  togglePill: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#cbd5e1",
    padding: 2,
    justifyContent: "center",
  },
  togglePillActive: {
    backgroundColor: "#0891b2",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  hydrationStationBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 218, 210, 0.4)",
  },
  hydrationStationLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  hydrationStationIntervalRow: {
    flexDirection: "row",
    gap: 8,
  },
  hydrationStationChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.5)",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationStationChipActive: {
    backgroundColor: "#0891b2",
    borderColor: "#0891b2",
  },
  hydrationStationChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
  },
  hydrationStationChipTextActive: {
    color: "#ffffff",
    fontWeight: "900",
  },
  hydrationStationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  hydrationStationSyncNotice: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.colors.cardTextSecondary,
  },
  hydrationStationTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(8, 145, 178, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  hydrationStationTestBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0891b2",
  },
  roadmapIntroBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(8, 145, 178, 0.1)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
    marginBottom: 4,
  },
  roadmapIntroText: {
    flex: 1,
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  roadmapSlotCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  roadmapSlotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  roadmapTime: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: "800",
  },
  roadmapMlBadge: {
    backgroundColor: "rgba(8, 145, 178, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
  },
  roadmapMlText: {
    color: "#0891b2",
    fontSize: 11,
    fontWeight: "800",
  },
  roadmapPeriodName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  roadmapPurpose: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  urineGuideCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  urineGuideTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  urineColorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  urineGuideTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  urineStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  urineStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  urineGuideDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
});
