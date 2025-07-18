import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageSquare, Settings, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { voiceDebugger } from '@/utils/VoiceDebugger';
import type { Bot } from '@/hooks/useBots';
import type { Message } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { ChatHistory } from './ChatHistory';
import { SettingsPanel } from './SettingsPanel';
import { VoiceVisualization } from './VoiceVisualization';
import { VoiceAudioManager, AudioPlaybackQueue, AudioChunk } from '@/utils/VoiceAudioManager';
import { AudioQueue } from '@/utils/AudioQueue';

interface RealtimeVoiceChatProps {
  botName: string;
  botId: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'timestamp' | 'id'>) => Message;
  onSaveConversation: (messages: Message[]) => Promise<void>;
  activeBot: Bot;
  onUpdateBot: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
}

export function RealtimeVoiceChat({ 
  botName, 
  botId, 
  messages, 
  onAddMessage, 
  onSaveConversation, 
  activeBot, 
  onUpdateBot
}: RealtimeVoiceChatProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [showSettings, setShowSettings] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [vadStatus, setVadStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const voiceManagerRef = useRef<VoiceAudioManager | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const { toast } = useToast();
  // Use the singleton voiceDebugger

  const addDebugInfo = useCallback((info: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev.slice(-9), `[${timestamp}] ${info}`]);
    console.log(`[${timestamp}] ${info}`);
  }, []);

  const cleanup = useCallback(() => {
    voiceManagerRef.current?.stop();
    voiceManagerRef.current = null;
    
    audioQueueRef.current?.stop();
    audioQueueRef.current = null;
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setVadStatus('idle');
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  const startVoiceSession = useCallback(async () => {
    if (isConnected) return;
    
    console.log('🎤 Starting voice session with VAD...');
    voiceDebugger.log('info', 'Starting voice session with VAD');
    setConnectionStatus('connecting');
    addDebugInfo('Initializing voice session...');

    try {
      // Initialize audio playback queue
      audioQueueRef.current = new AudioQueue();
      addDebugInfo('Audio playback queue initialized');

      // Initialize voice audio manager with VAD
      voiceManagerRef.current = new VoiceAudioManager({
        onSpeechStart: () => {
          console.log('🗣️ Speech detected by VAD');
          setVadStatus('speaking');
          setIsListening(true);
          addDebugInfo('VAD: Speech started');
          
          // Interrupt any current audio playback
          if (audioQueueRef.current) {
            audioQueueRef.current.stop();
            addDebugInfo('Interrupted AI speech');
          }
          
          // Send interrupt signal to server
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'interrupt'
            }));
          }
        },
        onSpeechEnd: () => {
          console.log('🤐 Speech ended by VAD');
          setVadStatus('listening');
          setIsListening(false);
          addDebugInfo('VAD: Speech ended');
        },
        onVADMisfire: () => {
          console.log('🔄 VAD misfire detected');
          addDebugInfo('VAD misfire detected');
        },
        onAudioChunk: (chunk: AudioChunk) => {
          // Send audio chunk to server for STT
          if (wsRef.current?.readyState === WebSocket.OPEN && vadStatus === 'speaking') {
            const base64Audio = VoiceAudioManager.encodeAudioToBase64(chunk.data);
            wsRef.current.send(JSON.stringify({
              type: 'audio_chunk',
              audio: base64Audio,
              timestamp: chunk.timestamp
            }));
          }
        },
        positiveSpeechThreshold: 0.6,
        negativeSpeechThreshold: 0.4,
        minSpeechFrames: 6
      });

      await voiceManagerRef.current.initialize();
      addDebugInfo('Voice manager initialized with VAD');

      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session token');
      }

      // Connect to realtime voice function - use direct project URL
      const wsUrl = `wss://nlxpyaeufqabcyimlohn.supabase.co/functions/v1/realtime-voice`;
      
      console.log('🔥 CONNECTING TO REALTIME VOICE:', wsUrl);
      voiceDebugger.log('info', 'Connecting to realtime voice', { url: wsUrl });
      addDebugInfo('Connecting to realtime voice server...');

      // Create WebSocket with auth headers
      wsRef.current = new WebSocket(wsUrl);
      
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('🔥 CONNECTION TIMEOUT');
          wsRef.current.close();
          setConnectionStatus('error');
          cleanup();
          addDebugInfo('Connection timeout');
          toast({
            title: "Connection Failed",
            description: "Voice session connection timed out",
            variant: "destructive",
          });
        }
      }, 15000);

      wsRef.current.onopen = () => {
        console.log('🔥 REALTIME VOICE CONNECTED!');
        clearTimeout(connectionTimeout);
        voiceDebugger.log('info', 'Realtime voice connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        setVadStatus('listening');
        addDebugInfo('WebSocket connected successfully');
        
        // Start voice session with auth token
        const sessionMessage = {
          type: 'start_session',
          botId: activeBot.id,
          userId: user.id,
          accessToken: session.access_token
        };
        
        console.log('🔥 SENDING SESSION START:', sessionMessage);
        wsRef.current!.send(JSON.stringify(sessionMessage));

        // Start VAD
        voiceManagerRef.current?.start();
        addDebugInfo('VAD started - listening for speech');

        toast({
          title: "Connected",
          description: "Real-time voice chat started",
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('🔥 RECEIVED:', data.type);
          
          switch (data.type) {
            case 'connection_ready':
              console.log('✅ Connection ready');
              addDebugInfo('Connection ready');
              break;

            case 'stt_ready':
              console.log('✅ STT ready');
              addDebugInfo('Speech-to-text ready');
              break;

            case 'user_message':
              console.log('📝 User message processed:', data.content);
              addDebugInfo(`User message processed: "${data.content}"`);
              break;
              
            case 'session_started':
              console.log('✅ Session started:', data.sessionId);
              addDebugInfo(`Session started: ${data.sessionId}`);
              break;
              
            case 'transcript':
              setCurrentTranscript(data.transcript);
              addDebugInfo(`Transcript: "${data.transcript}" (final: ${data.is_final})`);
              
              if (data.is_final) {
                // Add user message
                const userMessage = onAddMessage({
                  content: data.transcript,
                  type: 'user'
                });
                setCurrentTranscript('');
                addDebugInfo(`User message added: "${data.transcript}"`);
              }
              break;
              
            case 'ai_response':
              console.log('🤖 Received AI text response');
              addDebugInfo(`AI response: ${data.content}`);
              
              // Add AI message to chat
              onAddMessage({
                content: data.content,
                type: 'bot'
              });
              break;

            case 'audio_response':
              console.log('🔊 Received audio response');
              setIsSpeaking(true);
              addDebugInfo(`Received audio response: ${data.text}`);
              
              // Play audio
              if (audioQueueRef.current && !isMuted) {
                audioQueueRef.current.addToQueue(data.audio);
              }
              
              // Auto-stop speaking after a reasonable time
              setTimeout(() => setIsSpeaking(false), Math.max(2000, data.text.length * 50));
              break;
              
            case 'interrupted':
              console.log('🛑 Session interrupted');
              setIsSpeaking(false);
              addDebugInfo('Session interrupted by user');
              break;
              
            case 'error':
              console.error('🔥 Server error:', data.message);
              addDebugInfo(`Server error: ${data.message}`);
              toast({
                title: "Voice Error",
                description: data.message,
                variant: "destructive",
              });
              break;
              
            default:
              console.log('Unknown message type:', data.type);
              addDebugInfo(`Unknown message type: ${data.type}`);
          }
        } catch (error) {
          console.error('🔥 Error parsing message:', error);
          addDebugInfo(`Error parsing message: ${error.message}`);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('🔥 WEBSOCKET CLOSED:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        addDebugInfo(`WebSocket closed: ${event.code} - ${event.reason}`);
        cleanup();
      };

      wsRef.current.onerror = (error) => {
        console.error('🔥 WEBSOCKET ERROR:', error);
        clearTimeout(connectionTimeout);
        setConnectionStatus('error');
        addDebugInfo(`WebSocket error: ${error}`);
        cleanup();
        toast({
          title: "Connection Error",
          description: "Failed to establish voice connection",
          variant: "destructive",
        });
      };

    } catch (error) {
      console.error('🔥 ERROR STARTING VOICE SESSION:', error);
      setConnectionStatus('error');
      cleanup();
      addDebugInfo(`Failed to start session: ${error.message}`);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start voice session",
        variant: "destructive",
      });
    }
  }, [isConnected, toast, activeBot, onAddMessage, addDebugInfo, isMuted, vadStatus]);

  const stopVoiceSession = useCallback(async () => {
    console.log('🎤 Stopping voice session...');
    voiceDebugger.log('info', 'Stopping voice session');
    addDebugInfo('Stopping voice session...');

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_session' }));
      wsRef.current.close();
      wsRef.current = null;
    }

    cleanup();
    addDebugInfo('Voice session stopped');
    
    toast({
      title: "Disconnected",
      description: "Voice session ended",
    });
  }, [toast, cleanup, addDebugInfo]);

  const handleVoiceToggle = useCallback(async () => {
    if (isConnected) {
      await stopVoiceSession();
    } else {
      await startVoiceSession();
    }
  }, [isConnected, startVoiceSession, stopVoiceSession]);

  const handleInterrupt = useCallback(() => {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.interrupt();
    }
    if (audioQueueRef.current) {
      audioQueueRef.current.stop();
    }
    addDebugInfo('Manual interrupt triggered');
  }, [addDebugInfo]);

  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (newMuted && audioQueueRef.current) {
      audioQueueRef.current.stop();
    }
    
    addDebugInfo(`Audio ${newMuted ? 'muted' : 'unmuted'}`);
  }, [isMuted, addDebugInfo]);

  const sendTextMessage = useCallback(async () => {
    if (!textInput.trim()) return;

    // Add user message immediately
    const userMessage = onAddMessage({
      content: textInput,
      type: 'user'
    });

    const messageText = textInput;
    setTextInput('');
    addDebugInfo(`Text message sent: "${messageText}"`);

    // Send to voice server if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const textMessage = {
        type: 'text_message',
        text: messageText
      };
      
      console.log('🔥 SENDING TEXT MESSAGE:', textMessage);
      wsRef.current.send(JSON.stringify(textMessage));
    } else {
      addDebugInfo('Not connected to voice server - message sent to chat only');
    }
  }, [textInput, onAddMessage, addDebugInfo]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  }, [sendTextMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [cleanup]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{botName}</h1>
          <div className="flex gap-2">
            <Badge 
              variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
              className="mb-2"
            >
              {connectionStatus === 'connected' ? '🟢 Connected' : 
               connectionStatus === 'connecting' ? '🟡 Connecting...' : 
               connectionStatus === 'error' ? '🔴 Error' : '⚫ Disconnected'}
            </Badge>
            
            {vadStatus !== 'idle' && (
              <Badge variant="outline" className="mb-2 ml-2">
                {vadStatus === 'listening' ? '👂 Listening' : 
                 vadStatus === 'speaking' ? '🗣️ Speaking' : ''}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInputMode(inputMode === 'voice' ? 'text' : 'voice')}
          >
            {inputMode === 'voice' ? <MessageSquare className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {inputMode === 'voice' ? 'Text' : 'Voice'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-hidden">
        <ChatHistory messages={messages} onClearMessages={() => {}} />
      </div>

      {/* Current Transcript Display */}
      {currentTranscript && (
        <div className="px-4 py-2 bg-muted/30 border-t">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Transcribing: </span>
            <span className="italic">{currentTranscript}</span>
          </div>
        </div>
      )}

      {/* Input Section */}
      {inputMode === 'voice' ? (
        <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <Button
              onClick={handleVoiceToggle}
              disabled={connectionStatus === 'connecting'}
              variant={isConnected ? "destructive" : "default"}
              size="lg"
              className="flex-1"
            >
              {connectionStatus === 'connecting' ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : isConnected ? (
                <>
                  <PhoneOff className="h-5 w-5 mr-2" />
                  End Call
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5 mr-2" />
                  Start Call
                </>
              )}
            </Button>
            
            {isConnected && isSpeaking && (
              <Button
                onClick={handleInterrupt}
                variant="outline"
                size="lg"
              >
                🛑 Interrupt
              </Button>
            )}

            <Button
              onClick={handleMuteToggle}
              variant="outline"
              size="lg"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          </div>

          {isConnected && (
            <div className="space-y-4">
              <VoiceVisualization 
                isListening={isListening} 
                isSpeaking={isSpeaking}
                isMuted={isMuted}
                isConnected={isConnected}
                onToggleListening={handleVoiceToggle}
                onToggleMute={handleMuteToggle}
                onStop={stopVoiceSession}
              />
              
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {vadStatus === 'speaking' ? "🗣️ Speaking detected..." : 
                   vadStatus === 'listening' ? "👂 Listening for speech..." : 
                   isSpeaking ? "🔊 AI Speaking..." : 
                   "💬 Ready to chat"}
                </p>
                
                {currentTranscript && (
                  <div className="bg-muted p-2 rounded text-sm">
                    <span className="text-muted-foreground">Transcribing: </span>
                    {currentTranscript}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
          <div className="flex gap-2">
            <Textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 resize-none"
              rows={2}
            />
            <Button
              onClick={sendTextMessage}
              disabled={!textInput.trim()}
              size="lg"
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {/* Debug Info Panel */}
      {debugInfo.length > 0 && (
        <div className="p-2 bg-muted/20 border-t">
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">Debug Info ({debugInfo.length})</summary>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {debugInfo.map((info, i) => (
                <div key={i} className="text-muted-foreground font-mono">{info}</div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onToggle={() => setShowSettings(false)}
        activeBot={activeBot}
        onUpdateBot={onUpdateBot}
      />
    </div>
  );
}