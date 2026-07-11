import { useState, useRef, useEffect } from "react";
import { 
  useGetMyProfile, 
  useListConversations, 
  useCreateConversation, 
  useGetConversation,
  useDeleteConversation,
  useListMessages,
  getListConversationsQueryKey,
  getListMessagesQueryKey, 
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { Brain, Send, Mic, MicOff, Volume2, VolumeX, Plus, MessageSquare, Trash2, Camera, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSpeech } from "@/hooks/useSpeech";
import { useToast } from "@/hooks/use-toast";

export default function Coach() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile } = useGetMyProfile();
  const { data: conversations, isLoading: isConvosLoading } = useListConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setActiveConvoId(null);
      }
    }
  });

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  
  // Set first convo active if none selected
  useEffect(() => {
    if (!activeConvoId && Array.isArray(conversations) && conversations.length) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  const { data: historyMessages, isLoading: isMessagesLoading } = useListMessages(
    activeConvoId ?? 0,
    { query: { enabled: !!activeConvoId, queryKey: getListMessagesQueryKey(activeConvoId ?? 0) } }
  );

  const [input, setInput] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isListening, transcript, startListening, stopListening, isSupported: speechSupported, speak, isSpeaking, stopSpeaking } = useSpeech();
  const [ttsEnabled, setTtsEnabled] = useState(false);

  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [historyMessages, streamingMessage]);

  const handleCreateConvo = async () => {
    const res = await createConversation.mutateAsync({ data: { title: "New Conversation" } });
    qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    setActiveConvoId((res as any).id);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const sendStreamingMessage = async (id: number, content: string, imageBase64Data?: string) => {
    setIsStreaming(true);
    setStreamingMessage("");
    try {
      const url = `${import.meta.env.BASE_URL}api/anthropic/conversations/${id}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, ...(imageBase64Data ? { imageBase64: imageBase64Data } : {}) }),
      });
      
      if (!res.body) throw new Error("No response body");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullMessage = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              fullMessage += data.content;
              setStreamingMessage(fullMessage);
            } else if (data.done) {
              if (ttsEnabled) {
                speak(fullMessage);
              }
              qc.invalidateQueries({ queryKey: getListMessagesQueryKey(id) });
            } else if (data.error) {
              toast({ title: "Error", description: data.error, variant: "destructive" });
            }
          } catch (e) {
            console.error("Parse error", e);
          }
        }
      }
    } catch (error) {
      toast({ title: "Error sending message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !imageBase64) || isStreaming) return;
    
    let targetConvoId = activeConvoId;
    if (!targetConvoId) {
      const res = await createConversation.mutateAsync({ data: { title: "New Conversation" } });
      qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      targetConvoId = (res as any).id;
      setActiveConvoId((res as any).id);
    }
    const finalConvoId = targetConvoId!;
    
    const userContent = input.trim();
    const userImage = imageBase64;
    
    setInput("");
    setImageBase64(null);
    stopListening();
    
    // Optimistically add user message
    qc.setQueryData(getListMessagesQueryKey(finalConvoId), (old: any) => {
      if (!old) return old;
      return [...old, { id: Date.now(), role: "user", content: userContent || "[Image attached]", createdAt: new Date().toISOString() }];
    });
    
    await sendStreamingMessage(finalConvoId, userContent, userImage || undefined);
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-12rem)] flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      <Card className="w-full md:w-64 shrink-0 shadow-sm h-48 md:h-full overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <Button className="w-full justify-start shadow-sm" onClick={handleCreateConvo} disabled={createConversation.isPending}>
            <Plus className="w-4 h-4 mr-2" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isConvosLoading ? <LoadingState /> : !Array.isArray(conversations) || conversations.length === 0 ? (
             <div className="p-4 text-center text-sm text-muted-foreground">No conversations yet</div>
          ) : (
            conversations.map(c => (
              <div key={c.id} className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${activeConvoId === c.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`} onClick={() => setActiveConvoId(c.id)}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate">{c.title || "Chat"}</span>
                </div>
                <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteConversation.mutate({ conversationId: c.id }); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Main Chat */}
      <Card className="flex-1 flex flex-col h-full shadow-sm overflow-hidden border-border/50 relative">
        <div className="p-4 border-b bg-background/80 backdrop-blur-md flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Brain className="w-4 h-4" />
            </div>
            <h2 className="font-semibold tracking-tight">Lumen Coach</h2>
          </div>
          <div className="flex items-center gap-2">
            {speechSupported && (
              <Button variant="ghost" size="icon" onClick={() => { ttsEnabled ? stopSpeaking() : undefined; setTtsEnabled(!ttsEnabled); }} className={ttsEnabled ? "text-primary bg-primary/10" : "text-muted-foreground"}>
                {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-muted/20">
          {!activeConvoId ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState icon={<Brain className="w-8 h-8 text-primary" />} title="Lumen AI Coach" description="Start a new conversation to get personalized guidance." />
            </div>
          ) : isMessagesLoading ? (
            <LoadingState />
          ) : (
            <>
              {(Array.isArray(historyMessages) ? historyMessages : []).map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                    m.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-card border border-border/50 rounded-tl-sm"
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    
                    {/* Explainable AI UI Hook (Phase 10) */}
                    {m.role !== "user" && (
                      <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        <details className="cursor-pointer group">
                          <summary className="font-medium text-primary/70 flex items-center gap-1 list-none">
                            <Brain className="w-3 h-3" /> How did Lumen know this?
                          </summary>
                          <div className="mt-2 p-2 bg-background/50 rounded-lg space-y-1">
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Connected from: Sleep data (Oura Ring)</div>
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Memory retrieval: "User struggles with late-night carb cravings"</div>
                            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Scientific context: Huberman Lab protocol on circadian rhythm</div>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isStreaming && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm bg-card border border-border/50 rounded-tl-sm">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingMessage}<span className="inline-block w-2 h-4 ml-1 bg-primary/60 animate-pulse align-middle"></span></p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-4 bg-background border-t">
          {imageBase64 && (
            <div className="mb-3 relative inline-block">
              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-primary/20 shadow-sm">
                <img src={imageBase64} alt="Upload preview" className="w-full h-full object-cover" />
              </div>
              <button onClick={() => setImageBase64(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <div className="flex-1 bg-muted/40 border rounded-2xl flex items-center pr-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 transition-shadow">
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-primary rounded-full m-1" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-5 h-5" />
              </Button>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              
              <Input 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                placeholder="Ask about your sleep, diet, or routine..." 
                className="border-0 bg-transparent focus-visible:ring-0 shadow-none px-2 h-12 text-sm"
                disabled={isStreaming}
              />
              
              {speechSupported && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className={`shrink-0 rounded-full m-1 ${isListening ? "text-destructive bg-destructive/10 animate-pulse" : "text-muted-foreground hover:text-primary"}`} 
                  onClick={isListening ? stopListening : startListening}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
              )}
            </div>
            <Button type="submit" size="icon" disabled={(!input.trim() && !imageBase64) || isStreaming} className="h-12 w-12 rounded-full shrink-0 shadow-sm transition-transform active:scale-95">
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}