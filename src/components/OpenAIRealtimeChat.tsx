import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Settings, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceVisualization } from './VoiceVisualization';
import { ChatHistory } from './ChatHistory';
import { SettingsPanel } from './SettingsPanel';
import { Textarea } from './ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { AudioRecorder, encodeAudioForAPI, playAudioData, clearAudioQueue } from '@/utils/AudioProcessor';
import type { Bot } from '@/hooks/useBots';
import type { Message } from '@/hooks/useConversations';

interface OpenAIRealtimeChatProps {
  botName: string;
  botId: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'timestamp' | 'id'>) => Message;
  onSaveConversation: (messages: Message[]) => Promise<void>;
  activeBot: Bot;
  onUpdateBot: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
}

export function OpenAIRealtimeChat({ 
  botName, 
  botId, 
  messages, 
  onAddMessage, 
  onSaveConversation, 
  activeBot, 
  onUpdateBot 
}: OpenAIRealtimeChatProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startRealtimeSession = async () => {
    try {
      setConnecting(true);
      console.log('Starting OpenAI Realtime session...');
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Initialize audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Connect to our Supabase edge function
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//nlxpyaeufqabcyimlohn.functions.supabase.co/openai-realtime`;
      
      console.log('Connecting to:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Connected to OpenAI Realtime proxy');
        
        // Start session with bot configuration
        wsRef.current?.send(JSON.stringify({
          type: 'start_session',
          botName: activeBot.name,
          personality: activeBot.personality,
          voice: activeBot.voice || 'alloy'
        }));
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Connection failed');
        setConnecting(false);
        setIsConnected(false);
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
        setConnecting(false);
      };

    } catch (error) {
      console.error('Failed to start realtime session:', error);
      toast.error(`Failed to start: ${error.message}`);
      setConnecting(false);
    }
  };

  const setupAudioRecording = async () => {
    try {
      console.log('Setting up audio recording...');
      
      audioRecorderRef.current = new AudioRecorder((audioData: Float32Array) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const base64Audio = encodeAudioForAPI(audioData);
          wsRef.current.send(JSON.stringify({
            type: 'send_audio',
            audio: base64Audio
          }));
        }
      });

      await audioRecorderRef.current.start();
      setIsListening(true);
      console.log('Audio recording started');
      
    } catch (error) {
      console.error('Failed to setup audio recording:', error);
      toast.error('Microphone access failed');
    }
  };

  const handleWebSocketMessage = async (data: any) => {
    console.log('WebSocket message:', data.type);
    
    switch (data.type) {
      case 'session_connecting':
        console.log('Session connecting...');
        break;
        
      case 'session_ready':
        console.log('Session ready!');
        setIsConnected(true);
        setConnecting(false);
        toast.success('Voice chat connected');
        
        // Start audio recording
        if (inputMode === 'voice') {
          await setupAudioRecording();
        }
        break;
        
      case 'audio_delta':
        if (!isMuted && audioContextRef.current) {
          setIsSpeaking(true);
          
          // Convert base64 to Uint8Array
          const binaryString = atob(data.delta);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          await playAudioData(audioContextRef.current, bytes);
        }
        break;
        
      case 'transcript_delta':
        setCurrentResponse(prev => prev + data.delta);
        break;
        
      case 'user_transcript':
        setTranscript(data.transcript);
        const userMsg = {
          role: 'user' as const,
          content: data.transcript,
          type: 'user' as const
        };
        onAddMessage(userMsg);
        setTimeout(() => setTranscript(''), 2000);
        break;
        
      case 'response_started':
        setCurrentResponse('');
        setIsSpeaking(true);
        break;
        
      case 'response_completed':
        if (currentResponse.trim()) {
          const botMsg = {
            role: 'assistant' as const,
            content: currentResponse,
            type: 'bot' as const
          };
          onAddMessage(botMsg);
        }
        setCurrentResponse('');
        setIsSpeaking(false);
        break;
        
      case 'session_ended':
        console.log('Session ended');
        setIsConnected(false);
        break;
        
      case 'error':
        console.error('Session error:', data.message);
        toast.error(data.message);
        break;
    }
  };

  const stopRealtimeSession = () => {
    console.log('Stopping realtime session...');
    
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    clearAudioQueue();
    
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setTranscript('');
    setCurrentResponse('');
    toast.success('Voice chat ended');
  };

  const handleToggleVoice = () => {
    if (isConnected) {
      stopRealtimeSession();
    } else {
      startRealtimeSession();
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleInputModeToggle = () => {
    setInputMode(inputMode === 'voice' ? 'text' : 'voice');
  };

  const sendTextMessage = async () => {
    if (!textInput.trim() || !wsRef.current) return;
    
    const currentInput = textInput;
    setTextInput('');
    
    // Send text message through WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'send_text',
      text: currentInput
    }));
    
    // Add user message to chat immediately
    const userMsg = {
      role: 'user' as const,
      content: currentInput,
      type: 'user' as const
    };
    onAddMessage(userMsg);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  useEffect(() => {
    return () => {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.stop();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{botName}</h1>
          {isConnected && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">OpenAI Live</span>
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

      {/* Chat History */}
      <div className="flex-1 min-h-0">
        <ChatHistory messages={messages} onClearMessages={() => {}} />
      </div>

      {/* Real-time transcript and response */}
      <AnimatePresence>
        {(transcript || currentResponse) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2 bg-muted/50"
          >
            <div className="text-sm text-muted-foreground">
              {transcript && (
                <div className="text-foreground font-medium mb-1">
                  🎤 You: {transcript}
                </div>
              )}
              {currentResponse && (
                <div className="text-primary italic">
                  🤖 {activeBot.name}: {currentResponse}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Controls */}
      <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        {inputMode === 'voice' ? (
          <div className="flex flex-col items-center space-y-4">
            {/* Voice Control Buttons */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMuteToggle}
                className={`rounded-full ${isMuted ? 'text-destructive' : ''}`}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>

              <Button
                onClick={handleToggleVoice}
                disabled={connecting}
                size="lg"
                className={`rounded-full w-16 h-16 ${
                  isConnected 
                    ? 'bg-destructive hover:bg-destructive/90' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {connecting ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-background border-t-transparent" />
                ) : isConnected ? (
                  <PhoneOff className="w-6 h-6" />
                ) : (
                  <Phone className="w-6 h-6" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleInputModeToggle}
                className="rounded-full"
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
            </div>

            {/* Voice Visualization */}
            <VoiceVisualization 
              isListening={isListening}
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              isConnected={isConnected}
              onToggleListening={handleToggleVoice}
              onToggleMute={handleMuteToggle}
              onStop={stopRealtimeSession}
            />

            {/* Status */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {connecting ? 'Connecting to OpenAI...' : 
                 !isConnected ? 'Click to start OpenAI Realtime voice chat' :
                 isListening ? '🎤 Listening...' : 
                 isSpeaking ? '🔊 AI Speaking...' : 
                 '⭐ Ready - Start talking naturally'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleInputModeToggle}
              className="rounded-full"
            >
              <Mic className="w-5 h-5" />
            </Button>
            
            <div className="flex-1 flex gap-2">
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 min-h-[44px] resize-none"
                rows={1}
              />
              <Button
                onClick={sendTextMessage}
                disabled={!textInput.trim() || !isConnected}
                size="sm"
              >
                Send
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(false)}
        activeBot={activeBot}
        onUpdateBot={onUpdateBot}
      />
    </div>
  );
}