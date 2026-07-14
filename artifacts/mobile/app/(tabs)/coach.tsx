import { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Platform, KeyboardAvoidingView } from "react-native";
import { 
  useGetProfile, 
  useListConversations, 
  useCreateConversation, 
  useListMessages, 
  useSendAnthropicMessage,
  getListConversationsQueryKey,
  getListMessagesQueryKey, 
  getGetTodayDashboardQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Send, Mic, Image, Sparkles, User, Volume2, VolumeX } from "lucide-react-native";
import { speakText, stopSpeaking, parseVoiceCommand } from "@/services/voice";

export default function CoachScreen() {
  const qc = useQueryClient();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [inputText, setInputText] = useState("");
  const { data: profile } = useGetProfile();
  const { data: conversations } = useListConversations();
  const createConversation = useCreateConversation();
  const sendMessageMutation = useSendAnthropicMessage();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [spokenMessageId, setSpokenMessageId] = useState<string | null>(null);

  // Auto-select or create conversation
  useEffect(() => {
    if (!activeConvoId && Array.isArray(conversations) && conversations.length > 0) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  const { data: messages } = useListMessages(activeConvoId ?? 0, {
    query: {
      enabled: !!activeConvoId,
      queryKey: getListMessagesQueryKey(activeConvoId ?? 0),
    }
  });

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInputText("");

    let targetConvoId = activeConvoId;
    if (!targetConvoId) {
      try {
        const res = await createConversation.mutateAsync({ data: {} });
        qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        targetConvoId = (res as any).id;
        setActiveConvoId((res as any).id);
      } catch {
        alert("Failed to initialize chat session");
        return;
      }
    }

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: String(targetConvoId),
        data: { content: text }
      });
      // Invalidate queries to reload messages list from database
      qc.invalidateQueries({ queryKey: getListMessagesQueryKey(targetConvoId!) });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
    } catch {
      alert("Failed to send message");
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      setIsListening(false);
      // Simulate speech input transcript trigger
      const mockSpeech = "Log 500ml water";
      const result = parseVoiceCommand(mockSpeech);
      alert(`Voice recognized: "${mockSpeech}"\n${result.explanation}`);
      if (result.action === "log_water") {
        handleSend(mockSpeech);
      }
    } else {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        const mockSpeech = "Suggest today's workout";
        const result = parseVoiceCommand(mockSpeech);
        alert(`Voice recognized: "${mockSpeech}"\n${result.explanation}`);
        handleSend(mockSpeech);
      }, 2500);
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

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  }, [messages]);

  const suggestedPrompts = [
    { text: "Analyze my day", action: "Give me an AI summary of my progress today." },
    { text: "Today's nutrition", action: "What is my calorie and protein status today?" },
    { text: "Workout suggestions", action: "Suggest a quick 20 minute workout based on my readiness." }
  ];

  const messageList = Array.isArray(messages) ? messages : [];

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Brain size={18} color="#10b981" />
          </View>
          <Text style={styles.logoText}>Lumen Coach</Text>
        </View>
        <Text style={styles.logoSub}>Grounded in biometric context</Text>
      </View>

      {/* Main chat window */}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
      >
        {messageList.length > 0 ? (
          messageList.map((m: any, idx: number) => {
            const isUser = m.role === "user";
            const messageId = m.id || String(idx);
            return (
              <View 
                key={idx} 
                style={[
                  styles.bubbleContainer, 
                  isUser ? styles.userBubbleContainer : styles.coachBubbleContainer
                ]}
              >
                {!isUser && (
                  <View style={styles.coachAvatar}>
                    <Brain size={12} color="#10b981" />
                  </View>
                )}
                <View 
                  style={[
                    styles.bubble, 
                    isUser ? styles.userBubble : styles.coachBubble
                  ]}
                >
                  <Text 
                    style={[
                      styles.bubbleText, 
                      isUser ? styles.userBubbleText : styles.coachBubbleText
                    ]}
                  >
                    {m.content}
                  </Text>
                  
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
          })
        ) : (
          <View style={styles.welcomeContainer}>
            <Brain size={48} color="#10b981" style={{ marginBottom: 15 }} />
            <Text style={styles.welcomeTitle}>Ask your AI Health Coach</Text>
            <Text style={styles.welcomeDesc}>
              Lumen Coach automatically understands your steps, sleep hours, mood index, and nutrition logs to give hyper-grounded answers.
            </Text>
          </View>
        )}

        {/* Suggested Prompt Cards */}
        {messageList.length === 0 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsTitle}>Suggested Prompts</Text>
            <View style={styles.suggestionsList}>
              {suggestedPrompts.map((s, idx) => (
                <Pressable 
                  key={idx} 
                  style={styles.suggestionCard}
                  onPress={() => handleSend(s.action)}
                >
                  <Sparkles size={12} color="#10b981" />
                  <Text style={styles.suggestionText}>{s.text}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input area */}
      <View style={styles.inputBar}>
        <Pressable 
          style={[styles.iconBtn, isListening && styles.listeningMic]} 
          onPress={handleMicPress}
        >
          <Mic size={20} color={isListening ? "#050b08" : "#64748b"} />
        </Pressable>
        <TextInput
          style={styles.textInput}
          placeholder="Ask anything..."
          placeholderTextColor="#475569"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend(inputText)}
        />
        <Pressable style={styles.sendBtn} onPress={() => handleSend(inputText)}>
          <Send size={16} color="#050b08" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 15,
    marginBottom: 10,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  logoText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#e2e8f0",
  },
  logoSub: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 25,
    gap: 15,
  },
  welcomeContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 80,
    gap: 10,
  },
  welcomeTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  welcomeDesc: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  suggestions: {
    marginTop: 40,
    gap: 12,
  },
  suggestionsTitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  suggestionsList: {
    gap: 8,
  },
  suggestionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
  },
  suggestionText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "500",
  },
  bubbleContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    maxWidth: "85%",
  },
  userBubbleContainer: {
    alignSelf: "flex-end",
  },
  coachBubbleContainer: {
    alignSelf: "flex-start",
  },
  coachAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "relative",
  },
  userBubble: {
    backgroundColor: "#10b981",
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderBottomLeftRadius: 4,
    paddingBottom: 24, // spacing for speech indicator
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userBubbleText: {
    color: "#050b08",
    fontWeight: "500",
  },
  coachBubbleText: {
    color: "#f8fafc",
  },
  voiceIndicator: {
    position: "absolute",
    right: 12,
    bottom: 6,
  },
  inputBar: {
    height: 70,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    backgroundColor: "#050b08",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 22,
    paddingHorizontal: 16,
    color: "#f8fafc",
    fontSize: 14,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  listeningMic: {
    backgroundColor: "#10b981",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
});
