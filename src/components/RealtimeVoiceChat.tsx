import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceVisualization } from './VoiceVisualization';
import { ChatHistory } from './ChatHistory';
import { SettingsPanel } from './SettingsPanel';
import { useAuth } from '@/hooks/useAuth';
import type { Bot } from '@/hooks/useBots';
import type { Message } from '@/hooks/useConversations';

interface RealtimeVoiceChatProps {
  botName: string;
  botId: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'timestamp' | 'id'>) => Message;
  onSaveConversation: (messages: Message[]) => Promise<void>;
  activeBot: Bot;
  onUpdateBot: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
}

// Voice Activity Detection using WebRTC
class VoiceActivityDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private threshold = 30;
  private isActive = false;
  private onVoiceStart: () => void;
  private onVoiceEnd: () => void;
  private checkInterval: number | null = null;

  constructor(onVoiceStart: () => void, onVoiceEnd: () => void) {
    this.onVoiceStart = onVoiceStart;
    this.onVoiceEnd = onVoiceEnd;
  }

  async initialize(stream: MediaStream) {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.source = this.audioContext.createMediaStreamSource(stream);
    
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.source.connect(this.analyser);
    
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.startDetection();
  }

  private startDetection() {
    this.checkInterval = window.setInterval(() => {
      if (!this.analyser || !this.dataArray) return;
      
      this.analyser.getByteFrequencyData(this.dataArray);
      const average = this.dataArray.reduce((a, b) => a + b) / this.dataArray.length;
      
      if (average > this.threshold && !this.isActive) {
        this.isActive = true;
        this.onVoiceStart();
      } else if (average <= this.threshold && this.isActive) {
        this.isActive = false;
        this.onVoiceEnd();
      }
    }, 100);
  }

  disconnect() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
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
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentUserMessage, setCurrentUserMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const startRealtimeSession = async () => {
    try {
      setConnecting(true);
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get microphone access with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;

      // Connect to realtime voice WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/functions/v1/realtime-voice`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Connected to realtime voice');
        setIsConnected(true);
        setConnecting(false);
        
        // Start session
        wsRef.current?.send(JSON.stringify({
          type: 'start_session',
          botId: activeBot.id,
          userId: user.id
        }));

        setupAudioRecording(stream);
        toast.success('Voice chat connected');
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

      wsRef.current.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsListening(false);
        setIsSpeaking(false);
      };

    } catch (error) {
      console.error('Failed to start realtime session:', error);
      toast.error(`Failed to start: ${error.message}`);
      setConnecting(false);
    }
  };

  const setupAudioRecording = (stream: MediaStream) => {
    // Setup MediaRecorder for continuous audio streaming
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        // Convert to base64 and send immediately
        const reader = new FileReader();
        reader.onload = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          wsRef.current?.send(JSON.stringify({
            type: 'audio_chunk',
            audio: base64Audio
          }));
        };
        reader.readAsDataURL(event.data);
      }
    };

    // Setup Voice Activity Detection
    vadRef.current = new VoiceActivityDetector(
      () => {
        setIsListening(true);
        if (isSpeaking) {
          // Stop bot audio if user starts speaking (interruption)
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setIsSpeaking(false);
        }
      },
      () => {
        setIsListening(false);
      }
    );

    vadRef.current.initialize(stream);

    // Start recording with small chunks for real-time processing
    mediaRecorder.start(100); // 100ms chunks
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'session_started':
        console.log('Session started:', data.sessionId);
        break;
        
      case 'transcript':
        setTranscript(data.text);
        if (data.isFinal) {
          setCurrentUserMessage(data.text);
          setTimeout(() => setTranscript(''), 2000);
        }
        break;
        
      case 'user_message':
        const userMsg = {
          role: 'user' as const,
          content: data.content,
          type: 'user' as const
        };
        onAddMessage(userMsg);
        setCurrentUserMessage('');
        break;
        
      case 'ai_response':
        const botMsg = {
          role: 'assistant' as const,
          content: data.content,
          type: 'bot' as const
        };
        onAddMessage(botMsg);
        break;
        
      case 'audio_response':
        playAudioResponse(data.audio);
        break;
        
      case 'error':
        console.error('Voice error:', data.message);
        toast.error(data.message);
        break;
        
      case 'session_ended':
        console.log('Session ended');
        break;
    }
  };

  const playAudioResponse = (audioData: string) => {
    setIsSpeaking(true);
    
    try {
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsSpeaking(false);
      };
      
      audio.onerror = () => {
        setIsSpeaking(false);
        console.error('Error playing audio response');
      };
      
      if (!isMuted) {
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsSpeaking(false);
        });
      }
    } catch (error) {
      console.error('Error creating audio:', error);
      setIsSpeaking(false);
    }
  };

  const stopRealtimeSession = () => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop_session' }));
      wsRef.current.close();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (vadRef.current) {
      vadRef.current.disconnect();
    }

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setTranscript('');
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
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (vadRef.current) {
        vadRef.current.disconnect();
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
              <span className="text-sm text-muted-foreground">Live</span>
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

      {/* Real-time transcript */}
      <AnimatePresence>
        {(transcript || currentUserMessage) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2 bg-muted/50"
          >
            <div className="text-sm text-muted-foreground">
              {currentUserMessage ? (
                <span className="text-foreground font-medium">You: {currentUserMessage}</span>
              ) : (
                <span className="italic">Listening: {transcript}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Controls */}
      <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center space-y-4">
          {/* Control Buttons */}
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
              className="rounded-full"
              disabled
            >
              <Mic className="w-5 h-5" />
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
              {connecting ? 'Connecting...' : 
               !isConnected ? 'Click to start real-time voice chat' :
               isListening ? '🎤 Listening...' : 
               isSpeaking ? '🔊 Speaking...' : 
               '⭐ Ready - Start talking'}
            </p>
          </div>
        </div>
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