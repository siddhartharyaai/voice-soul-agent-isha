import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mic, 
  MicOff, 
  MessageSquare, 
  Volume2, 
  VolumeX, 
  Loader2,
  Settings,
  Square,
  Send
} from 'lucide-react';
import { VoiceVisualization } from './VoiceVisualization';
import { ChatBubble } from './ChatBubble';

import { SettingsPanel } from './SettingsPanel';
import { APIKeyModal } from './APIKeyModal';
import { Message } from '@/hooks/useConversations';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAPIKeys } from '@/hooks/useAPIKeys';
import { cn } from '@/lib/utils';
import { Logger } from '@/utils/logger';

interface VoiceBotProps {
  botName: string;
  botId: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  onSaveConversation: (messages: Message[]) => void;
  activeBot?: any;
  onUpdateBot?: (botId: string, updates: any) => Promise<any>;
  mcpServers?: any[];
}

export function VoiceBot({ botName, botId, messages, onAddMessage, onSaveConversation, activeBot, onUpdateBot, mcpServers }: VoiceBotProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [isConnecting, setIsConnecting] = useState(false);
  const [voiceSession, setVoiceSession] = useState<any>(null);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeyModal, setApiKeyModal] = useState<{ isOpen: boolean; service: 'gemini' | 'deepgram' | 'perplexity' | 'openai' | 'notion' | 'slack' | 'todoist' | 'github' | 'spotify' | 'google' | null }>({ isOpen: false, service: null });
  const [textInput, setTextInput] = useState('');
  const [transcription, setTranscription] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  
  const { user } = useAuth();
  const { saveAPIKey } = useAPIKeys();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced backend URL detection with better fallback
  const backendUrl = (() => {
    // Check if backend is accessible locally
    if (import.meta.env.DEV) {
      return 'http://localhost:8000';
    }
    // Production deployment URL (customize for your deployment)
    return 'https://your-backend-url.onrender.com';
  })();

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startVoiceSession = async () => {
    if (!user || !botId) {
      Logger.error('Voice session start failed: Missing user or botId', { user: !!user, botId });
      return;
    }
    
    Logger.voice('Starting voice session', { botId, userId: user.id });
    setIsConnecting(true);
    
    try {
      // Check backend connectivity first
      Logger.debug('Checking backend connectivity', { url: backendUrl });
      
      const healthCheck = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!healthCheck.ok) {
        throw new Error(`Backend not responding (${healthCheck.status}). Please start the backend server with: cd backend && python start_backend.py`);
      }
      
      Logger.info('Backend health check passed');
      
      // Request microphone access
      Logger.debug('Requesting microphone access');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      Logger.voice('Microphone access granted');
      
      // Start voice session with backend
      const response = await fetch(`${backendUrl}/api/voice-session/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(user as any).access_token || 'demo'}`
        },
        body: JSON.stringify({
          user_id: user.id,
          bot_id: botId
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Voice session start failed: ${response.status} - ${errorData}`);
      }
      
      const sessionData = await response.json();
      Logger.voice('Voice session created', { sessionId: sessionData.session_id });
      setVoiceSession(sessionData);

      // Connect WebSocket with enhanced error handling
      const wsUrl = `ws://localhost:8000/ws/${sessionData.session_id}`;
      Logger.debug('Connecting WebSocket', { url: wsUrl });
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        Logger.voice('WebSocket connected');
        setIsListening(true);
        toast({
          title: "Voice session started",
          description: "You can now speak to your assistant",
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          Logger.voice('WebSocket message received', { type: data.type });
          
          if (data.type === 'response') {
            // Add bot response to messages
            onAddMessage({
              type: 'bot',
              content: data.text,
            });
            
            // Play audio if available
            if (data.audio && !isMuted) {
              Logger.voice('Playing audio response');
              playAudioResponse(data.audio);
            }
          } else if (data.type === 'transcription') {
            Logger.voice('Transcription received', { text: data.text });
            setTranscription(data.text);
          } else if (data.type === 'error') {
            Logger.error('WebSocket error message', data);
            toast({
              variant: "destructive",
              title: "Voice error",
              description: data.error || "An error occurred during voice processing",
            });
          }
        } catch (error) {
          Logger.error('Error parsing WebSocket message', error);
        }
      };

      ws.onerror = (error) => {
        Logger.error('WebSocket error', error);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to maintain voice connection",
        });
      };

      ws.onclose = (event) => {
        Logger.voice('WebSocket closed', { code: event.code, reason: event.reason });
        setIsListening(false);
        setIsSpeaking(false);
      };

      // Setup audio recording
      setupAudioRecording(stream);
      
    } catch (error: any) {
      Logger.error('Voice session start error', error);
      
      let errorMessage = error.message || "Failed to start voice session";
      
      // Enhanced error messages for common issues
      if (error.message?.includes('Backend not responding')) {
        errorMessage = "Backend server not running. Please start it with: cd backend && python start_backend.py";
      } else if (error.message?.includes('getUserMedia')) {
        errorMessage = "Microphone access denied. Please allow microphone access and try again.";
      } else if (error.message?.includes('NetworkError')) {
        errorMessage = "Network error. Please check your internet connection and backend server.";
      }
      
      toast({
        variant: "destructive",
        title: "Voice session failed",
        description: errorMessage,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const stopVoiceSession = async () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    
    if (voiceSession) {
      try {
        await fetch(`${backendUrl}/api/voice-session/${voiceSession.session_id}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Error ending voice session:', error);
      }
    }
    
    setIsListening(false);
    setIsSpeaking(false);
    setVoiceSession(null);
  };

  const setupAudioRecording = (stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    
    const audioChunks: BlobPart[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64Audio
          }));
        }
      };
      
      reader.readAsDataURL(audioBlob);
      audioChunks.length = 0;
    };
    
    // Record in chunks for real-time processing
    const recordChunk = () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        setTimeout(() => {
          if (isListening) {
            mediaRecorder.start();
            setTimeout(recordChunk, 1000); // 1 second chunks
          }
        }, 100);
      }
    };
    
    mediaRecorder.start();
    setTimeout(recordChunk, 1000);
  };

  const playAudioResponse = (audioData: string) => {
    setIsSpeaking(true);
    
    try {
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      
      audio.onended = () => {
        setIsSpeaking(false);
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
      };
      
      audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  };

  const handleVoiceToggle = async () => {
    if (isListening) {
      await stopVoiceSession();
    } else {
      await startVoiceSession();
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleInputModeToggle = () => {
    setInputMode(inputMode === 'voice' ? 'text' : 'voice');
  };

  const sendTextMessage = () => {
    if (!textInput.trim()) return;
    
    onAddMessage({
      type: 'user',
      content: textInput,
    });
    
    setTextInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };


  const handleSaveAPIKey = async (service: string, apiKey: string) => {
    try {
      await saveAPIKey(service, apiKey);
      toast({
        title: "API Key saved",
        description: `${service} API key has been saved securely`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save API key",
        description: error.message || "An error occurred while saving the API key",
      });
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="h-screen bg-background flex flex-col">{/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">{/* Header */}
        <div className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">{botName}</h1>
            {isConnecting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col relative">
          <ScrollArea ref={chatContainerRef} className="flex-1 p-4">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-12 h-12 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Start a conversation with {botName}
                  </h3>
                  <p className="text-muted-foreground">
                    Click the microphone to speak or switch to text mode
                  </p>
                </motion.div>
              ) : (
                messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))
              )}
              
              {/* Real-time transcription */}
              {transcription && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div className="bg-primary/20 text-primary px-3 py-2 rounded-lg text-sm">
                    {transcription}
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Bottom Bar */}
          <div className="border-t border-border bg-background/95 backdrop-blur-sm p-4">
            <div className="max-w-4xl mx-auto">
              {inputMode === 'voice' ? (
                <div className="flex flex-col items-center space-y-4">
                  {/* Voice Visualization */}
                  <VoiceVisualization 
                    isListening={isListening}
                    isSpeaking={isSpeaking}
                    isMuted={isMuted}
                    isConnected={!isConnecting}
                    onToggleListening={handleVoiceToggle}
                    onToggleMute={handleMuteToggle}
                    onStop={() => setIsListening(false)}
                    className="scale-75"
                  />

                  {/* Controls */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMuteToggle}
                      className={cn(
                        "h-10 w-10 rounded-full",
                        isMuted && "bg-destructive/20 text-destructive"
                      )}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleInputModeToggle}
                      className="h-10 w-10 rounded-full"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>

                    {(isListening || isSpeaking) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsListening(false)}
                        className="h-10 w-10 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Transcription display */}
                  {isListening && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center"
                    >
                      <p className="text-sm text-muted-foreground">
                        {transcription || "Listening..."}
                      </p>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="flex items-end gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleInputModeToggle}
                    className="h-10 w-10 rounded-full shrink-0"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex-1 relative">
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="w-full min-h-[44px] max-h-32 px-4 py-3 pr-12 rounded-2xl border border-border bg-background/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      rows={1}
                    />
                    <Button
                      size="sm"
                      onClick={sendTextMessage}
                      disabled={!textInput.trim()}
                      className="absolute right-2 bottom-2 h-8 w-8 rounded-full p-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(false)}
        onShowAPIKeyModal={(service) => setApiKeyModal({ isOpen: true, service })}
      />

      {/* API Key Modal */}
      <APIKeyModal
        isOpen={apiKeyModal.isOpen}
        onClose={() => setApiKeyModal({ isOpen: false, service: null })}
        service={apiKeyModal.service}
        onSave={handleSaveAPIKey}
      />
    </div>
  );
}