import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
} from "react-native";
import {
  useGetProfile,
  useListConversations,
  useCreateConversation,
  useSendAnthropicMessage,
  getListConversationsQueryKey,
  getGetTodayDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Send,
  Mic,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Utensils,
  Moon,
  Activity,
  Smartphone,
  ShieldCheck,
  Plus,
  RefreshCw,
  Check,
  Zap,
  X,
  Key,
} from "lucide-react-native";
import { speakText, stopSpeaking, parseVoiceCommand } from "@/services/voice";
import { useSlideMenu } from "@/context/SlideMenuContext";
import THEME from "@/constants/theme";
import { AmbientAtmosphere } from "@/components/AmbientAtmosphere";
import {
  getCoachMessages,
  saveCoachMessage,
  clearCoachMessages,
  CoachMessageRecord,
} from "@/services/db";
import {
  buildFullHealthContextModel,
  extractAndStoreMemories,
  generateLocalCoachResponse,
  HealthContextModel,
} from "@/services/coachMemory";
import {
  askGeminiCoach,
  getGeminiApiKey,
  setGeminiApiKey,
  testGeminiApiKey,
  DEFAULT_GEMINI_API_KEY,
} from "@/services/geminiAi";

function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <Text style={[styles.bubbleText, styles.userBubbleText]}>{content}</Text>;
  }

  const lines = content.split("\n");

  return (
    <View style={styles.formattedContainer}>
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={lIdx} style={{ height: 6 }} />;
        }

        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const cleanLine = isBullet ? trimmed.replace(/^(\u2022|\-|\*)\s*/, "") : trimmed;
        const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);

        return (
          <View key={lIdx} style={isBullet ? styles.bulletRow : styles.lineBlock}>
            {isBullet && <View style={styles.bulletDot} />}
            <Text style={[styles.bubbleText, styles.coachBubbleText, isBullet && styles.bulletText]}>
              {parts.map((part, pIdx) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <Text key={pIdx} style={styles.boldCoachText}>
                      {part.slice(2, -2)}
                    </Text>
                  );
                }
                return <Text key={pIdx}>{part}</Text>;
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function CoachScreen() {
  const qc = useQueryClient();
  const { openLeftMenu } = useSlideMenu();
  const scrollViewRef = useRef<ScrollView>(null);

  const [inputText, setInputText] = useState("");
  const { data: profile } = useGetProfile();
  const { data: conversations } = useListConversations();
  const createConversation = useCreateConversation();
  const sendMessageMutation = useSendAnthropicMessage();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [spokenMessageId, setSpokenMessageId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Array<CoachMessageRecord>>([]);
  const [isThinking, setIsThinking] = useState(false);

  // Health Context Model & Memory Engine state
  const [healthContext, setHealthContext] = useState<HealthContextModel | null>(null);
  const [showContextRadar, setShowContextRadar] = useState(false);

  // Google Gemini AI Engine State
  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState(DEFAULT_GEMINI_API_KEY);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestFeedback, setGeminiTestFeedback] = useState<string | null>(null);

  // Initialize master SQLite chat history & telemetry context
  useEffect(() => {
    async function initChatAndContext() {
      try {
        const currentKey = await getGeminiApiKey();
        setGeminiKeyInput(currentKey);

        const ctx = await buildFullHealthContextModel();
        setHealthContext(ctx);

        const storedMsgs = await getCoachMessages("1");
        if (storedMsgs && storedMsgs.length > 0) {
          setLocalMessages(storedMsgs);
        } else {
          const welcomeMsg: CoachMessageRecord = {
            id: `msg-${Date.now()}`,
            conversationId: "1",
            role: "assistant",
            content: `Hello ${ctx.profile.name}! I am Lumen Coach, your personalized bio-intelligence advisor.\n\nMy Memory Engine is connected to your **Nutrition** (${ctx.nutrition.totalCalories} kcal), **Sleep** (${ctx.sleep.durationHours}h), **Activity** (${ctx.activity.steps.toLocaleString()} steps), and **Screen Time** (${ctx.screenTime.hoursStr}).\n\nHow can I help optimize your recovery and performance today?`,
            timestamp: new Date().toISOString(),
          };
          await saveCoachMessage(welcomeMsg);
          setLocalMessages([welcomeMsg]);
        }
      } catch (err) {
        console.warn("Failed to load coach context / messages:", err);
      }
    }
    initChatAndContext();
  }, []);

  // Auto-select or create conversation
  useEffect(() => {
    if (!activeConvoId && Array.isArray(conversations) && conversations.length > 0) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInputText("");

    // 1. Build and refresh live health context model
    const currentContext = healthContext || (await buildFullHealthContextModel());
    setHealthContext(currentContext);

    // 2. Extract and store any new long-term health memories
    try {
      const extracted = await extractAndStoreMemories(text, currentContext);
      if (extracted) {
        const updatedCtx = await buildFullHealthContextModel();
        setHealthContext(updatedCtx);
      }
    } catch {}

    // 3. Persist User Message to SQLite Master Database
    const userMsgId = `u-${Date.now()}`;
    const userMsg: CoachMessageRecord = {
      id: userMsgId,
      conversationId: "1",
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    await saveCoachMessage(userMsg);
    setLocalMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    let assistantResponseText = "";

    // 4. Primary: Direct High-Intelligence Google Gemini AI Engine
    try {
      assistantResponseText = await askGeminiCoach(
        text,
        localMessages.map((m) => ({ role: m.role, content: m.content })),
        currentContext
      );
    } catch (geminiErr: any) {
      console.warn("Direct Gemini call returned error, attempting backend/local fallback:", geminiErr);
      
      // Secondary: Try backend server if reachable
      try {
        let targetConvoId = activeConvoId || 1;
        const augmentedPrompt = `${text}\n\n[CURRENT USER BIO-METRICS CONTEXT]:\n${currentContext.compiledTelemetrySnapshot}`;

        const res = await sendMessageMutation.mutateAsync({
          conversationId: String(targetConvoId),
          data: { content: augmentedPrompt },
        });

        if (res && (res as any).content) {
          assistantResponseText = (res as any).content;
        } else {
          assistantResponseText = generateLocalCoachResponse(
            text,
            currentContext,
            localMessages.map((m) => ({ role: m.role, content: m.content }))
          );
        }
      } catch (backendErr) {
        // Tertiary offline fallback: Local Neural-Heuristic Context Model
        console.log("Using Local Context Memory Model for coach answer:", backendErr);
        assistantResponseText = generateLocalCoachResponse(
          text,
          currentContext,
          localMessages.map((m) => ({ role: m.role, content: m.content }))
        );
      }
    } finally {
      // 5. Persist Assistant Response to SQLite Master Database
      const assistantMsgId = `a-${Date.now()}`;
      const assistantMsg: CoachMessageRecord = {
        id: assistantMsgId,
        conversationId: "1",
        role: "assistant",
        content: assistantResponseText,
        timestamp: new Date().toISOString(),
      };
      await saveCoachMessage(assistantMsg);
      setLocalMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      setIsListening(false);
      const mockSpeech = "How is my nutrition and calories today?";
      const result = parseVoiceCommand(mockSpeech);
      handleSend(mockSpeech);
    } else {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        const mockSpeech = "Give me an AI summary of my progress today.";
        handleSend(mockSpeech);
      }, 2000);
    }
  };

  const toggleSpeakMessage = (messageId: string, content: string) => {
    if (spokenMessageId === messageId) {
      stopSpeaking();
      setSpokenMessageId(null);
    } else {
      setSpokenMessageId(messageId);
      speakText(content, () => setSpokenMessageId(null));
    }
  };

  const handleTestGeminiKey = async () => {
    setIsTestingGemini(true);
    setGeminiTestFeedback(null);
    try {
      const res = await testGeminiApiKey(geminiKeyInput);
      setGeminiTestFeedback(res.message);
      if (res.success) {
        await setGeminiApiKey(geminiKeyInput);
      }
    } catch (e: any) {
      setGeminiTestFeedback("Error: " + e.message);
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!geminiKeyInput.trim()) {
      Alert.alert("Empty Key", "Please enter a valid Gemini API key.");
      return;
    }
    await setGeminiApiKey(geminiKeyInput);
    Alert.alert("Gemini Key Activated", "Your Google Gemini API key has been securely saved and activated.");
    setShowGeminiModal(false);
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear Chat History",
      "Reset consultation history? (Your health data and memories remain intact in the database).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearCoachMessages("1");
            const ctx = healthContext || (await buildFullHealthContextModel());
            const welcomeMsg: CoachMessageRecord = {
              id: `msg-${Date.now()}`,
              conversationId: "1",
              role: "assistant",
              content: `Chat history cleared. I'm ready to assist you based on your live health telemetry (${ctx.nutrition.totalCalories} kcal, ${ctx.activity.steps.toLocaleString()} steps, ${ctx.sleep.durationHours}h sleep).`,
              timestamp: new Date().toISOString(),
            };
            await saveCoachMessage(welcomeMsg);
            setLocalMessages([welcomeMsg]);
          },
        },
      ]
    );
  };

  const suggestedPrompts = [
    { text: "Bio-Intelligence Summary", action: "Give me an AI summary of my progress today." },
    { text: "Nutrition & Macros Status", action: "How is my calorie, protein, and nutrition status today?" },
    { text: "Sleep & Circadian Analysis", action: "How was my sleep recovery and bedtime rhythm?" },
    { text: "Digital Wellbeing & Screen", action: "How is my phone screen time and focus balance today?" },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Ambient atmospheric backlight glow */}
      <AmbientAtmosphere variant="dashboard" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <View style={styles.logoRow}>
              <Image
                source={require("../../assets/icon.png")}
                style={{ width: 28, height: 28, borderRadius: 8, marginRight: 8 }}
                resizeMode="cover"
              />
              <Text style={styles.logoText}>Lumen Coach</Text>
            </View>
            <Text style={styles.logoSub}>Ground-Truth Memory Engine & Context Model</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              style={styles.geminiBadgePill}
              onPress={() => setShowGeminiModal(true)}
              accessibilityLabel="Gemini AI Settings"
            >
              <Sparkles size={11} color="#38bdf8" />
              <Text style={styles.geminiBadgeText}>Gemini AI</Text>
              <View style={styles.geminiActiveDot} />
            </Pressable>

            <Pressable
              onPress={handleClearHistory}
              style={styles.clearBtn}
              accessibilityLabel="Reset Chat"
            >
              <RefreshCw size={14} color="#64748b" />
            </Pressable>

            <Pressable onPress={openLeftMenu} accessibilityLabel="Open Navigation Menu">
              <View style={styles.avatarCircleSmall}>
                <Text style={styles.avatarInitialSmall}>
                  {profile?.name ? profile.name[0].toUpperCase() : "S"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* ========================================================= */}
        {/* INTERACTIVE MEMORY ENGINE & CONTEXT RADAR BAR             */}
        {/* ========================================================= */}
        <Pressable
          style={styles.contextPillBar}
          onPress={() => setShowContextRadar(!showContextRadar)}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
            <View style={styles.pulseGreenDot} />
            <Text style={styles.contextPillText} numberOfLines={1}>
              Memory Engine Active • 5 Live Telemetry Streams Connected
            </Text>
          </View>
          {showContextRadar ? (
            <ChevronUp size={14} color="#10b981" />
          ) : (
            <ChevronDown size={14} color="#10b981" />
          )}
        </Pressable>

        {/* Expandable Live Context Telemetry Radar */}
        {showContextRadar && healthContext && (
          <View style={styles.contextRadarDrawer}>
            <Text style={styles.radarSectionTitle}>LIVE BIO-TELEMETRY CONTEXT SNAPSHOT</Text>

            <View style={styles.radarMetricsGrid}>
              <View style={styles.radarMetricCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Utensils size={11} color="#10b981" />
                  <Text style={styles.radarCardLabel}>Nutrition</Text>
                </View>
                <Text style={styles.radarCardVal}>{healthContext.nutrition.totalCalories} kcal</Text>
                <Text style={styles.radarCardSub}>{healthContext.nutrition.totalProtein}g protein</Text>
              </View>

              <View style={styles.radarMetricCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Moon size={11} color="#f59e0b" />
                  <Text style={styles.radarCardLabel}>Sleep</Text>
                </View>
                <Text style={styles.radarCardVal}>{healthContext.sleep.durationHours}h</Text>
                <Text style={styles.radarCardSub}>{healthContext.sleep.quality}</Text>
              </View>

              <View style={styles.radarMetricCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Activity size={11} color="#06b6d4" />
                  <Text style={styles.radarCardLabel}>Activity</Text>
                </View>
                <Text style={styles.radarCardVal}>{healthContext.activity.steps.toLocaleString()}</Text>
                <Text style={styles.radarCardSub}>{healthContext.activity.activeCaloriesBurned} kcal</Text>
              </View>

              <View style={styles.radarMetricCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Smartphone size={11} color="#a855f7" />
                  <Text style={styles.radarCardLabel}>Screen</Text>
                </View>
                <Text style={styles.radarCardVal}>{healthContext.screenTime.hoursStr}</Text>
                <Text style={styles.radarCardSub}>{healthContext.screenTime.status}</Text>
              </View>
            </View>

            {/* Long-Term Memory Vectors */}
            <View style={styles.memoryVectorsSection}>
              <Text style={styles.radarSectionTitle}>
                LEARNED LONG-TERM MEMORIES ({healthContext.memories.length})
              </Text>
              {healthContext.memories.slice(0, 3).map((m) => (
                <View key={m.id} style={styles.memoryItemRow}>
                  <ShieldCheck size={11} color="#10b981" style={{ marginTop: 2 }} />
                  <Text style={styles.memoryFactText} numberOfLines={2}>
                    <Text style={{ color: "#10b981", fontWeight: "bold" }}>
                      [{m.category.toUpperCase()}]:{" "}
                    </Text>
                    {m.keyFact}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Main chat window */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {localMessages.map((m, idx) => {
          const isUser = m.role === "user";
          const messageId = m.id || String(idx);
          return (
            <View
              key={messageId}
              style={[
                styles.bubbleContainer,
                isUser ? styles.userBubbleContainer : styles.coachBubbleContainer,
              ]}
            >
              {!isUser && (
                <View style={styles.coachAvatar}>
                  <Brain size={12} color="#10b981" />
                </View>
              )}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.coachBubble]}>
                <FormattedMessage content={m.content} isUser={isUser} />

                {!isUser && (
                  <Pressable
                    onPress={() => toggleSpeakMessage(messageId, m.content)}
                    style={styles.voiceIndicator}
                  >
                    {spokenMessageId === messageId ? (
                      <VolumeX size={12} color="#10b981" />
                    ) : (
                      <Volume2 size={12} color="#64748b" />
                    )}
                  </Pressable>
                )}
              </View>
              {isUser && (
                <View style={styles.userAvatar}>
                  <User size={12} color="#050b08" />
                </View>
              )}
            </View>
          );
        })}

        {isThinking && (
          <View style={[styles.bubbleContainer, styles.coachBubbleContainer]}>
            <View style={styles.coachAvatar}>
              <Brain size={12} color="#10b981" />
            </View>
            <View
              style={[
                styles.bubble,
                styles.coachBubble,
                { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 12 },
              ]}
            >
              <Sparkles size={14} color="#38bdf8" />
              <Text style={[styles.bubbleText, styles.coachBubbleText, { fontStyle: "italic", color: "#94a3b8" }]}>
                Lumen Coach is analyzing your live biometrics with Google Gemini AI...
              </Text>
            </View>
          </View>
        )}

        {/* Suggested Quick Prompts */}
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>QUICK BIO-METRIC CONSULTATIONS</Text>
          <View style={styles.suggestionsList}>
            {suggestedPrompts.map((s, idx) => (
              <Pressable
                key={idx}
                style={styles.suggestionCard}
                onPress={() => handleSend(s.action)}
              >
                <Sparkles size={14} color="#10b981" />
                <Text style={styles.suggestionText}>{s.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <Pressable
          style={[styles.iconBtn, isListening && styles.listeningMic]}
          onPress={handleMicPress}
        >
          <Mic size={18} color={isListening ? "#050b08" : "#94a3b8"} />
        </Pressable>

        <TextInput
          style={styles.textInput}
          placeholder="Ask Lumen Coach anything..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend(inputText)}
          returnKeyType="send"
        />

        <Pressable
          style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
          onPress={() => handleSend(inputText)}
          disabled={!inputText.trim()}
        >
          <Send size={16} color="#050b08" />
        </Pressable>
      </View>

      {/* ========================================================= */}
      {/* MODAL: GEMINI API KEY & MODEL SETTINGS                   */}
      {/* ========================================================= */}
      <Modal visible={showGeminiModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.geminiModalContent}>
            <View style={styles.geminiModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#38bdf8" />
                <Text style={styles.geminiModalTitle}>Google Gemini AI Advisor</Text>
              </View>
              <Pressable onPress={() => setShowGeminiModal(false)}>
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14, paddingVertical: 10 }}>
              <Text style={styles.geminiModalDesc}>
                Lumen Chatbot connects directly to Google Gemini to analyze your live nutrition, sleep, steps, and screen time to generate personalized clinical bio-advice.
              </Text>

              <View>
                <Text style={styles.fieldLabel}>Active Gemini API Key</Text>
                <TextInput
                  style={styles.keyInput}
                  value={geminiKeyInput}
                  onChangeText={setGeminiKeyInput}
                  placeholder="Paste Gemini API Key..."
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {geminiTestFeedback && (
                <View style={[styles.testResultBox, geminiTestFeedback.includes("Connected") ? styles.testResultSuccess : styles.testResultInfo]}>
                  <Text style={styles.testResultText}>{geminiTestFeedback}</Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={styles.testKeyBtn}
                  onPress={handleTestGeminiKey}
                  disabled={isTestingGemini}
                >
                  <Zap size={14} color="#38bdf8" />
                  <Text style={styles.testKeyBtnText}>
                    {isTestingGemini ? "Testing..." : "Test API Connection"}
                  </Text>
                </Pressable>

                <Pressable style={styles.saveKeyBtn} onPress={handleSaveGeminiKey}>
                  <Check size={14} color="#050b08" strokeWidth={3} />
                  <Text style={styles.saveKeyBtnText}>Save Key</Text>
                </Pressable>
              </View>

              <View style={styles.modelBadgeRow}>
                <View style={styles.modelChip}>
                  <Text style={styles.modelChipText}>Model: gemini-1.5-flash</Text>
                </View>
                <View style={styles.modelChip}>
                  <Text style={styles.modelChipText}>Multi-Turn Memory: Active</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    backgroundColor: THEME.colors.bgGradientStart,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: THEME.colors.textOnDarkPrimary,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  logoSub: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircleSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(232, 241, 237, 0.15)",
    borderWidth: 1.5,
    borderColor: THEME.colors.accentGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialSmall: {
    color: THEME.colors.accentGreen,
    fontSize: 13,
    fontWeight: "bold",
  },
  contextPillBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(232, 241, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
  },
  pulseGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: THEME.colors.accentGreen,
  },
  contextPillText: {
    color: THEME.colors.accentGreen,
    fontSize: 11,
    fontWeight: "700",
  },
  contextRadarDrawer: {
    backgroundColor: "rgba(19, 34, 29, 0.8)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    padding: 12,
    marginTop: 8,
  },
  radarSectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.textOnDarkSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  radarMetricsGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  radarMetricCard: {
    flex: 1,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 8,
  },
  radarCardLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 9,
    fontWeight: "700",
  },
  radarCardVal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  radarCardSub: {
    color: THEME.colors.cardTextTertiary,
    fontSize: 9,
    marginTop: 1,
  },
  memoryVectorsSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 218, 210, 0.15)",
    paddingTop: 8,
    gap: 5,
  },
  memoryItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  memoryFactText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  bubbleContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
  },
  userBubbleContainer: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
    maxWidth: "85%",
  },
  coachBubbleContainer: {
    alignSelf: "flex-start",
    width: "100%",
    maxWidth: "100%",
  },
  coachAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(232, 241, 237, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.colors.accentGreen,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "relative",
  },
  userBubble: {
    backgroundColor: THEME.colors.accentTeal,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    borderBottomRightRadius: 4,
    flexShrink: 1,
  },
  coachBubble: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderBottomLeftRadius: 4,
    paddingBottom: 26,
    flex: 1,
    flexShrink: 1,
    ...THEME.shadows.cardLight,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
    flexWrap: "wrap",
  },
  userBubbleText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  coachBubbleText: {
    color: THEME.colors.cardTextPrimary,
  },
  formattedContainer: {
    gap: 4,
    width: "100%",
  },
  lineBlock: {
    width: "100%",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    width: "100%",
    paddingLeft: 2,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.accentGreen,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    flexShrink: 1,
  },
  boldCoachText: {
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
  },
  voiceIndicator: {
    position: "absolute",
    right: 12,
    bottom: 8,
  },
  suggestions: {
    marginTop: 20,
    gap: 10,
  },
  suggestionsTitle: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  suggestionsList: {
    gap: 8,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...THEME.shadows.cardLight,
  },
  suggestionText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  inputBar: {
    height: Platform.OS === "ios" ? 134 : 126,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 218, 210, 0.15)",
    backgroundColor: "rgba(19, 34, 29, 0.98)",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 76 : 70,
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    borderRadius: 22,
    paddingHorizontal: 16,
    color: "#ffffff",
    fontSize: 14,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
  },
  listeningMic: {
    backgroundColor: THEME.colors.accentGreen,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.accentGreen,
    alignItems: "center",
    justifyContent: "center",
  },

  // Gemini AI Badge & Modal Styles
  geminiBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 12,
  },
  geminiBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.accentGreen,
    letterSpacing: 0.3,
  },
  geminiActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.accentGreen,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  geminiModalContent: {
    backgroundColor: THEME.colors.drawerBg,
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.3)",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxHeight: "85%",
  },
  geminiModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    paddingBottom: 12,
  },
  geminiModalTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  geminiModalDesc: {
    fontSize: 11,
    color: THEME.colors.textOnDarkSecondary,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.textOnDarkSecondary,
    marginBottom: 4,
  },
  keyInput: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: THEME.colors.textOnDarkPrimary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  testResultBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  testResultSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  testResultInfo: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  testResultText: {
    fontSize: 11,
    color: THEME.colors.textOnDarkPrimary,
    lineHeight: 15,
  },
  testKeyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
    paddingVertical: 10,
    borderRadius: 12,
  },
  testKeyBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.textOnDarkPrimary,
  },
  saveKeyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveKeyBtnText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#ffffff",
  },
  modelBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  modelChip: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
  },
  modelChipText: {
    fontSize: 9,
    fontWeight: "700",
    color: THEME.colors.textOnDarkSecondary,
  },
});
