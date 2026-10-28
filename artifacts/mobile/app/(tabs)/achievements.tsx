import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Platform,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Trophy,
  Award,
  Flame,
  Zap,
  Footprints,
  Activity,
  HeartPulse,
  Droplet,
  Droplets,
  Moon,
  Sparkles,
  Utensils,
  Apple,
  Clock,
  Brain,
  Bot,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Medal,
  ChevronLeft,
  CheckCircle2,
  Lock,
  RefreshCw,
  X,
  Dumbbell,
} from "lucide-react-native";
import {
  Achievement,
  AchievementCategory,
  BadgeTier,
  GamificationProfile,
  evaluateAchievements,
  popPendingCelebration,
} from "@/services/achievements";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Helper icon resolver
function getAchievementIcon(iconName: string, size: number, color: string) {
  switch (iconName) {
    case "Flame":
      return <Flame size={size} color={color} />;
    case "ShieldAlert":
      return <ShieldAlert size={size} color={color} />;
    case "Award":
      return <Award size={size} color={color} />;
    case "Crown":
      return <Crown size={size} color={color} />;
    case "Footprints":
      return <Footprints size={size} color={color} />;
    case "Activity":
      return <Activity size={size} color={color} />;
    case "Trophy":
      return <Trophy size={size} color={color} />;
    case "Zap":
      return <Zap size={size} color={color} />;
    case "Medal":
      return <Medal size={size} color={color} />;
    case "Dumbbell":
      return <Dumbbell size={size} color={color} />;
    case "HeartPulse":
      return <HeartPulse size={size} color={color} />;
    case "Droplet":
      return <Droplet size={size} color={color} />;
    case "Droplets":
      return <Droplets size={size} color={color} />;
    case "Moon":
      return <Moon size={size} color={color} />;
    case "Sparkles":
      return <Sparkles size={size} color={color} />;
    case "Utensils":
      return <Utensils size={size} color={color} />;
    case "Apple":
      return <Apple size={size} color={color} />;
    case "Clock":
      return <Clock size={size} color={color} />;
    case "Brain":
      return <Brain size={size} color={color} />;
    case "Bot":
      return <Bot size={size} color={color} />;
    case "ShieldCheck":
      return <ShieldCheck size={size} color={color} />;
    default:
      return <Trophy size={size} color={color} />;
  }
}

// Tier Styling Configurations
const TIER_COLORS: Record<BadgeTier, { border: string; glow: string; text: string; bg: string }> = {
  bronze: {
    border: "rgba(217, 119, 6, 0.4)",
    glow: "rgba(217, 119, 6, 0.15)",
    text: "#d97706",
    bg: "rgba(217, 119, 6, 0.08)",
  },
  silver: {
    border: "rgba(148, 163, 184, 0.45)",
    glow: "rgba(148, 163, 184, 0.15)",
    text: "#cbd5e1",
    bg: "rgba(148, 163, 184, 0.08)",
  },
  gold: {
    border: "rgba(245, 158, 11, 0.55)",
    glow: "rgba(245, 158, 11, 0.22)",
    text: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
  },
  diamond: {
    border: "rgba(56, 189, 248, 0.6)",
    glow: "rgba(56, 189, 248, 0.25)",
    text: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.12)",
  },
};

const CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "All Badges" },
  { key: "unlocked", label: "Unlocked" },
  { key: "in_progress", label: "In Progress" },
  { key: "streaks", label: "Streaks" },
  { key: "fitness", label: "Fitness" },
  { key: "hydration", label: "Hydration" },
  { key: "sleep", label: "Sleep" },
  { key: "nutrition", label: "Nutrition" },
  { key: "mindfulness", label: "Focus" },
  { key: "ai", label: "AI Coach" },
  { key: "safety", label: "Safety" },
];

export default function AchievementsScreen() {
  const router = useRouter();

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [gamification, setGamification] = useState<GamificationProfile | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);
  const [celebrationBadge, setCelebrationBadge] = useState<Achievement | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load and evaluate achievements
  const loadData = useCallback(async () => {
    try {
      const res = await evaluateAchievements();
      setAchievements(res.achievements);
      setGamification(res.gamification);

      // Check if there is an in-app celebration queued
      const pending = await popPendingCelebration();
      if (pending) {
        setCelebrationBadge(pending);
      }
    } catch (err) {
      console.warn("Failed loading achievements:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filtered achievements list
  const filteredAchievements = useMemo(() => {
    if (selectedCategory === "all") return achievements;
    if (selectedCategory === "unlocked") return achievements.filter((a) => a.isUnlocked);
    if (selectedCategory === "in_progress") return achievements.filter((a) => !a.isUnlocked);
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityLabel="Back to Previous Screen"
          >
            <ChevronLeft size={22} color="#f8fafc" />
          </Pressable>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Trophy size={20} color="#f59e0b" />
              <Text style={styles.headerTitle}>Achievements & Badges</Text>
            </View>
            <Text style={styles.headerSub}>Gamified Consistency & Longevity Milestones</Text>
          </View>
        </View>

        <Pressable
          style={styles.refreshBtn}
          onPress={onRefresh}
          accessibilityLabel="Refresh Telemetry"
        >
          <RefreshCw size={18} color="#10b981" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        {/* ========================================================= */}
        {/* 1. HERO GAMIFICATION & LEVEL CARD                         */}
        {/* ========================================================= */}
        {gamification && (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View>
                <View style={styles.levelBadgeRow}>
                  <View style={styles.levelPill}>
                    <Crown size={12} color="#10b981" />
                    <Text style={styles.levelPillText}>LEVEL {gamification.currentLevel}</Text>
                  </View>
                  <Text style={styles.levelRankTitle}>{gamification.levelTitle}</Text>
                </View>
                <Text style={styles.xpText}>
                  {gamification.totalXp.toLocaleString()} <Text style={styles.xpSub}>Bio-XP Earned</Text>
                </Text>
              </View>

              <View style={styles.badgeCountCol}>
                <View style={styles.trophyIconBox}>
                  <Trophy size={24} color="#f59e0b" />
                </View>
                <Text style={styles.badgeRatioText}>
                  {gamification.unlockedCount} / {gamification.totalCount}
                </Text>
                <Text style={styles.badgeRatioSub}>Unlocked</Text>
              </View>
            </View>

            {/* Level Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabelLeft}>Progress to Level {gamification.currentLevel + 1}</Text>
                <Text style={styles.progressLabelRight}>{gamification.levelProgressPercent}%</Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${gamification.levelProgressPercent}%` },
                  ]}
                />
              </View>
              <Text style={styles.xpToNextText}>
                {gamification.nextLevelXp - gamification.totalXp > 0
                  ? `${(gamification.nextLevelXp - gamification.totalXp).toLocaleString()} XP to next tier`
                  : "Maximum Rank Achieved"}
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* 2. CONSISTENCY & STREAK BANNER                            */}
        {/* ========================================================= */}
        {gamification && (
          <View style={styles.streakBanner}>
            <View style={styles.streakFlameCol}>
              <Flame size={28} color="#ef4444" />
              <Text style={styles.streakNumber}>{gamification.currentStreakDays}</Text>
              <Text style={styles.streakDaysLabel}>DAYS</Text>
            </View>

            <View style={{ flex: 1, paddingLeft: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.streakBannerTitle}>Active Habit Streak</Text>
                <View style={styles.bestStreakPill}>
                  <Sparkles size={11} color="#f59e0b" />
                  <Text style={styles.bestStreakText}>Best: {gamification.bestStreakDays}d</Text>
                </View>
              </View>
              <Text style={styles.streakBannerDesc}>
                Log continuous workouts, hydration, sleep, or nutrition daily. Consistent habits compound cellular longevity and metabolic resilience.
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* 3. CATEGORY FILTER CHIPS                                  */}
        {/* ========================================================= */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ========================================================= */}
        {/* 4. ACHIEVEMENTS CARDS GRID                                */}
        {/* ========================================================= */}
        <View style={styles.badgesGrid}>
          {filteredAchievements.map((badge) => {
            const tierStyle = TIER_COLORS[badge.tier];
            const isUnlocked = badge.isUnlocked;

            return (
              <Pressable
                key={badge.id}
                style={[
                  styles.badgeCard,
                  { borderColor: isUnlocked ? tierStyle.border : "rgba(255,255,255,0.06)" },
                  isUnlocked && { backgroundColor: tierStyle.bg },
                ]}
                onPress={() => setSelectedBadge(badge)}
              >
                <View style={styles.cardHeaderRow}>
                  {/* Badge Icon Box */}
                  <View
                    style={[
                      styles.badgeIconBox,
                      {
                        backgroundColor: isUnlocked ? tierStyle.glow : "rgba(255,255,255,0.04)",
                        borderColor: isUnlocked ? tierStyle.border : "rgba(255,255,255,0.08)",
                      },
                    ]}
                  >
                    {getAchievementIcon(
                      badge.icon,
                      24,
                      isUnlocked ? tierStyle.text : "#475569"
                    )}
                  </View>

                  {/* Status Pill & Tier */}
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View
                      style={[
                        styles.tierTag,
                        { borderColor: tierStyle.border, backgroundColor: tierStyle.glow },
                      ]}
                    >
                      <Text style={[styles.tierTagText, { color: tierStyle.text }]}>
                        {badge.tier.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.xpPill}>
                      <Text style={styles.xpPillText}>+{badge.xp} XP</Text>
                    </View>
                  </View>
                </View>

                {/* Title & Description */}
                <View style={{ marginVertical: 8 }}>
                  <Text style={[styles.badgeTitle, isUnlocked && { color: "#f8fafc" }]}>
                    {badge.title}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>
                    {badge.description}
                  </Text>
                </View>

                {/* Progress Bar & Numerical Counter */}
                <View style={{ marginTop: "auto" }}>
                  <View style={styles.cardProgressRow}>
                    <Text style={styles.cardProgressText}>
                      {badge.currentValue.toLocaleString()} / {badge.target.toLocaleString()} {badge.unit}
                    </Text>
                    <Text style={[styles.cardProgressPercent, isUnlocked && { color: "#10b981" }]}>
                      {badge.progressPercent}%
                    </Text>
                  </View>

                  <View style={styles.cardTrack}>
                    <View
                      style={[
                        styles.cardFill,
                        {
                          width: `${badge.progressPercent}%`,
                          backgroundColor: isUnlocked ? tierStyle.text : "#10b981",
                        },
                      ]}
                    />
                  </View>

                  {/* Footer: Unlocked Stamp or Locked state */}
                  <View style={styles.cardFooter}>
                    {isUnlocked ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <CheckCircle2 size={13} color="#10b981" />
                        <Text style={styles.unlockedFooterText}>
                          {badge.unlockedAt
                            ? `Unlocked ${new Date(badge.unlockedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}`
                            : "Unlocked"}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Lock size={12} color="#64748b" />
                        <Text style={styles.lockedFooterText}>In Progress</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* ========================================================= */}
      {/* 5. MODAL: ACHIEVEMENT DETAIL & SCIENTIFIC LORE            */}
      {/* ========================================================= */}
      <Modal visible={!!selectedBadge} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {selectedBadge && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.tierTag,
                    {
                      borderColor: TIER_COLORS[selectedBadge.tier].border,
                      backgroundColor: TIER_COLORS[selectedBadge.tier].glow,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tierTagText,
                      { color: TIER_COLORS[selectedBadge.tier].text },
                    ]}
                  >
                    {selectedBadge.tier.toUpperCase()} TIER
                  </Text>
                </View>
                <Pressable onPress={() => setSelectedBadge(null)}>
                  <X size={20} color="#94a3b8" />
                </Pressable>
              </View>

              <View style={styles.modalBody}>
                <View
                  style={[
                    styles.modalIconBox,
                    {
                      backgroundColor: selectedBadge.isUnlocked
                        ? TIER_COLORS[selectedBadge.tier].glow
                        : "rgba(255,255,255,0.05)",
                      borderColor: selectedBadge.isUnlocked
                        ? TIER_COLORS[selectedBadge.tier].border
                        : "rgba(255,255,255,0.1)",
                    },
                  ]}
                >
                  {getAchievementIcon(
                    selectedBadge.icon,
                    48,
                    selectedBadge.isUnlocked
                      ? TIER_COLORS[selectedBadge.tier].text
                      : "#475569"
                  )}
                </View>

                <Text style={styles.modalTitle}>{selectedBadge.title}</Text>
                <Text style={styles.modalDesc}>{selectedBadge.description}</Text>

                {/* Scientific Physiological Lore */}
                <View style={styles.loreCard}>
                  <Text style={styles.loreHeading}>PHYSIOLOGICAL MECHANISM & BENEFIT</Text>
                  <Text style={styles.loreText}>{selectedBadge.lore}</Text>
                </View>

                {/* Progress Stats */}
                <View style={styles.modalStatsRow}>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatLabel}>Requirement</Text>
                    <Text style={styles.modalStatVal}>
                      {selectedBadge.target} {selectedBadge.unit}
                    </Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatLabel}>Current Progress</Text>
                    <Text
                      style={[
                        styles.modalStatVal,
                        selectedBadge.isUnlocked && { color: "#10b981" },
                      ]}
                    >
                      {selectedBadge.currentValue} ({selectedBadge.progressPercent}%)
                    </Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatLabel}>XP Reward</Text>
                    <Text style={[styles.modalStatVal, { color: "#f59e0b" }]}>
                      +{selectedBadge.xp} XP
                    </Text>
                  </View>
                </View>

                {/* Status Notice */}
                {selectedBadge.isUnlocked ? (
                  <View style={styles.unlockedNotice}>
                    <CheckCircle2 size={16} color="#10b981" />
                    <Text style={styles.unlockedNoticeText}>
                      Achieved! You have unlocked this badge and claimed +{selectedBadge.xp} Bio-XP.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.lockedNotice}>
                    <Lock size={16} color="#64748b" />
                    <Text style={styles.lockedNoticeText}>
                      Milestone is locked. Continue your routine to unlock and earn +{selectedBadge.xp} XP!
                    </Text>
                  </View>
                )}

                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedBadge(null)}
                >
                  <Text style={styles.modalCloseBtnText}>Done</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* 6. MODAL: INSTANT UNLOCK CELEBRATION MODAL                */}
      {/* ========================================================= */}
      <Modal visible={!!celebrationBadge} transparent animationType="slide">
        <View style={styles.celebrationOverlay}>
          {celebrationBadge && (
            <View style={styles.celebrationCard}>
              <View style={styles.confettiHeader}>
                <Sparkles size={24} color="#f59e0b" />
                <Text style={styles.celebrationPre}>ACHIEVEMENT UNLOCKED!</Text>
                <Sparkles size={24} color="#f59e0b" />
              </View>

              <View
                style={[
                  styles.celebrationIconBox,
                  {
                    backgroundColor: TIER_COLORS[celebrationBadge.tier].glow,
                    borderColor: TIER_COLORS[celebrationBadge.tier].border,
                  },
                ]}
              >
                {getAchievementIcon(
                  celebrationBadge.icon,
                  54,
                  TIER_COLORS[celebrationBadge.tier].text
                )}
              </View>

              <Text style={styles.celebrationTitle}>{celebrationBadge.title}</Text>
              <Text style={styles.celebrationDesc}>{celebrationBadge.description}</Text>

              <View style={styles.celebrationXpRow}>
                <View style={styles.celebrationXpPill}>
                  <Crown size={14} color="#10b981" />
                  <Text style={styles.celebrationXpText}>+{celebrationBadge.xp} BIO-XP AWARDED</Text>
                </View>
              </View>

              <Text style={styles.celebrationLore}>{celebrationBadge.lore}</Text>

              <Pressable
                style={styles.celebrationConfirmBtn}
                onPress={() => setCelebrationBadge(null)}
              >
                <Trophy size={18} color="#070c0a" />
                <Text style={styles.celebrationConfirmText}>Claim & Celebrate</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070c0a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#070c0a",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 2,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Hero Gamification Card
  heroCard: {
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelPillText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  levelRankTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
  },
  xpText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#10b981",
    marginTop: 2,
  },
  xpSub: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
  },
  badgeCountCol: {
    alignItems: "center",
  },
  trophyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  badgeRatioText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  badgeRatioSub: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  progressSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabelLeft: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  progressLabelRight: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10b981",
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  xpToNextText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 6,
    textAlign: "right",
  },

  // Streak Banner
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  streakFlameCol: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 14,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.08)",
  },
  streakNumber: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ef4444",
    marginTop: 2,
  },
  streakDaysLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: 0.5,
  },
  streakBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  bestStreakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestStreakText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#f59e0b",
  },
  streakBannerDesc: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 16,
    marginTop: 4,
  },

  // Category Filter
  categoryScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  categoryChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10b981",
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94a3b8",
  },
  categoryChipTextActive: {
    color: "#10b981",
  },

  // Badges Grid
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  badgeCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    minHeight: 190,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  badgeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tierTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierTagText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  xpPill: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  xpPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#f59e0b",
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#cbd5e1",
    marginBottom: 2,
  },
  badgeDesc: {
    fontSize: 10,
    color: "#64748b",
    lineHeight: 14,
  },
  cardProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardProgressText: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "600",
  },
  cardProgressPercent: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "800",
  },
  cardTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  cardFill: {
    height: "100%",
    borderRadius: 2.5,
  },
  cardFooter: {
    marginTop: 8,
  },
  unlockedFooterText: {
    fontSize: 10,
    color: "#10b981",
    fontWeight: "700",
  },
  lockedFooterText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },

  // Modal Detail Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0d1512",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalBody: {
    alignItems: "center",
    marginTop: 8,
  },
  modalIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc",
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  loreCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
    marginVertical: 14,
  },
  loreHeading: {
    fontSize: 9,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  loreText: {
    fontSize: 11,
    color: "#cbd5e1",
    lineHeight: 16,
  },
  modalStatsRow: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 12,
    padding: 10,
    justifyContent: "space-around",
    marginBottom: 14,
  },
  modalStatItem: {
    alignItems: "center",
  },
  modalStatLabel: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "600",
  },
  modalStatVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 2,
  },
  unlockedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    padding: 10,
    borderRadius: 10,
    width: "100%",
    marginBottom: 14,
  },
  unlockedNoticeText: {
    fontSize: 11,
    color: "#10b981",
    fontWeight: "600",
    flex: 1,
  },
  lockedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    borderRadius: 10,
    width: "100%",
    marginBottom: 14,
  },
  lockedNoticeText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
    flex: 1,
  },
  modalCloseBtn: {
    width: "100%",
    backgroundColor: "#10b981",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#070c0a",
  },

  // Instant Celebration Overlay
  celebrationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  celebrationCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0d1a14",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.4)",
    padding: 24,
    alignItems: "center",
  },
  confettiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  celebrationPre: {
    fontSize: 11,
    fontWeight: "900",
    color: "#f59e0b",
    letterSpacing: 1,
  },
  celebrationIconBox: {
    width: 90,
    height: 90,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  celebrationTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f8fafc",
    textAlign: "center",
    marginTop: 4,
  },
  celebrationDesc: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  celebrationXpRow: {
    marginVertical: 12,
  },
  celebrationXpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  celebrationXpText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  celebrationLore: {
    fontSize: 11,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 18,
    fontStyle: "italic",
  },
  celebrationConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    backgroundColor: "#f59e0b",
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
  },
  celebrationConfirmText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#070c0a",
  },
});
