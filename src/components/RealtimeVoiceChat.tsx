import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, MessageSquare, Settings, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { Bot } from '@/hooks/useBots';
import type { Message } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { ChatHistory } from './ChatHistory';
import { SettingsPanel } from './SettingsPanel';
import { VoiceVisualization } from './VoiceVisualization';
import { LiveKitVoiceManager, VoiceSession } from '@/utils/LiveKitVoiceManager';
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

  const voiceManagerRef = useRef<LiveKitVoiceManager | null>(null);
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const { toast } = useToast();

  const addDebugInfo = useCallback((info: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev.slice(-9), `[${timestamp}] ${info}`]);
    console.log(`[${timestamp}] ${info}`);
  }, []);

  const cleanup = useCallback(() => {
    voiceSessionRef.current?.cleanup();
    voiceSessionRef.current = null;
    voiceManagerRef.current = null;
    
    audioQueueRef.current?.stop();
    audioQueueRef.current = null;
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setIsListening(false);
    setIsSpeaking(false);
    setCurrentTranscript('');
  }, []);

  const startVoiceSession = useCallback(async () => {
    if (isConnected) return;
    
    console.log('🎤 Starting LiveKit voice session...');
    setConnectionStatus('connecting');
    addDebugInfo('Creating LiveKit voice session...');

    try {
      // Initialize audio playback queue
      audioQueueRef.current = new AudioQueue();
      addDebugInfo('Audio playback queue initialized');

      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create LiveKit voice manager with callbacks
      voiceManagerRef.current = new LiveKitVoiceManager({
        onTranscript: (transcript: string, isFinal: boolean) => {
          console.log('📝 Transcript:', transcript, 'Final:', isFinal);
          setCurrentTranscript(isFinal ? '' : transcript);
          addDebugInfo(`Transcript: "${transcript}" (final: ${isFinal})`);
          
          if (isFinal && transcript.trim().length > 2) {
            // Add user message to chat
            onAddMessage({
              content: transcript,
              type: 'user'
            });
            addDebugInfo(`User message added: "${transcript}"`);
          }
        },
        onAIResponse: (response: string) => {
          console.log('🤖 AI Response:', response);
          addDebugInfo(`AI response: ${response}`);
          
          // Add AI message to chat
          onAddMessage({
            content: response,
            type: 'bot'
          });
        },
        onAudioResponse: (audio: string) => {
          console.log('🔊 Audio response received');
          setIsSpeaking(true);
          addDebugInfo('Audio response received');
          
          // Play audio through queue
          if (audioQueueRef.current && !isMuted) {
            audioQueueRef.current.addToQueue(audio);
          }
          
          // Auto-stop speaking after reasonable time
          setTimeout(() => setIsSpeaking(false), 3000);
        },
        onError: (error: string) => {
          console.error('❌ Voice error:', error);
          addDebugInfo(`Error: ${error}`);
          toast({
            title: "Voice Error",
            description: error,
            variant: "destructive",
          });
        }
      });

      // Create voice session
      const session = await voiceManagerRef.current.createSession(activeBot.id, user.id);
      voiceSessionRef.current = session;
      
      console.log('✅ LiveKit voice session created');
      addDebugInfo(`Session created with bot: ${session.botConfig.name}`);
      
      setIsConnected(true);
      setConnectionStatus('connected');
      setIsListening(true);

      toast({
        title: "Connected",
        description: `Voice chat started with ${session.botConfig.name}`,
      });

    } catch (error) {
      console.error('❌ Failed to start voice session:', error);
      setConnectionStatus('error');
      cleanup();
      addDebugInfo(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Failed to start voice session",
        variant: "destructive",
      });
    }
  }, [isConnected, toast, activeBot, onAddMessage, addDebugInfo, isMuted]);

  const stopVoiceSession = useCallback(async () => {
    console.log('🔌 Stopping LiveKit voice session...');
    addDebugInfo('Stopping voice session...');

    if (voiceManagerRef.current) {
      await voiceManagerRef.current.disconnect();
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
    if (audioQueueRef.current) {
      audioQueueRef.current.stop();
      setIsSpeaking(false);
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
    onAddMessage({
      content: textInput,
      type: 'user'
    });

    const messageText = textInput;
    setTextInput('');
    addDebugInfo(`Text message sent: "${messageText}"`);

    // Process text through voice manager if connected
    if (voiceManagerRef.current && isConnected) {
      // Simulate sending text to voice processor
      try {
        const { data, error } = await supabase.functions.invoke('voice-processor', {
          body: {
            type: 'generate_response',
            data: { transcript: messageText },
            botConfig: voiceSessionRef.current?.botConfig
          }
        });

        if (data?.success) {
          // Add AI response
          onAddMessage({
            content: data.response,
            type: 'bot'
          });
          
          // Generate and play speech
          const ttsResponse = await supabase.functions.invoke('voice-processor', {
            body: {
              type: 'text_to_speech',
              data: { text: data.response },
              botConfig: voiceSessionRef.current?.botConfig
            }
          });

          if (ttsResponse.data?.success && audioQueueRef.current && !isMuted) {
            audioQueueRef.current.addToQueue(ttsResponse.data.audio);
            setIsSpeaking(true);
            setTimeout(() => setIsSpeaking(false), 3000);
          }
        }
      } catch (error) {
        console.error('Text processing error:', error);
      }
    } else {
      addDebugInfo('Not connected to voice server - message sent to chat only');
    }
  }, [textInput, onAddMessage, addDebugInfo, isConnected, isMuted]);

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
            
            {isListening && (
              <Badge variant="outline" className="mb-2 ml-2">
                👂 Listening
              </Badge>
            )}
            
            {isSpeaking && (
              <Badge variant="outline" className="mb-2 ml-2">
                🔊 Speaking
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
                  {isListening && !isSpeaking ? "👂 Listening for speech..." : 
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