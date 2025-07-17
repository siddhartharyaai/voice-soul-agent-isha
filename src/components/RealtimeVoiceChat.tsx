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
import { voiceDebugger } from '@/utils/VoiceDebugger';

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
      voiceDebugger.log('info', 'Starting real-time voice session...');
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

      // Use existing working edge function for WebSocket connection
      const wsUrl = `wss://nlxpyaeufqabcyimlohn.supabase.co/functions/v1/openai-realtime`;
      
      voiceDebugger.log('info', 'Attempting WebSocket connection', { url: wsUrl });
      console.log('Connecting to WebSocket:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        voiceDebugger.log('info', 'WebSocket connected successfully');
        console.log('Connected to realtime voice');
        setIsConnected(true);
        setConnecting(false);
        
        // Start session
        const sessionData = {
          type: 'start_session',
          botId: activeBot.id,
          userId: user.id
        };
        voiceDebugger.log('info', 'Sending session start request', sessionData);
        wsRef.current?.send(JSON.stringify(sessionData));

        setupAudioRecording(stream);
        toast.success('Voice chat connected');
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      wsRef.current.onerror = (error) => {
        voiceDebugger.log('error', 'WebSocket connection error', error);
        voiceDebugger.incrementCounter('errors');
        console.error('WebSocket error:', error);
        toast.error('Connection failed - check logs');
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
      voiceDebugger.log('error', 'Failed to start realtime session', error);
      voiceDebugger.incrementCounter('errors');
      console.error('Failed to start realtime session:', error);
      toast.error(`Failed to start: ${error.message}`);
      setConnecting(false);
    }
  };

  const setupAudioRecording = (stream: MediaStream) => {
    console.log('Setting up optimized audio recording for real-time processing...');
    
    // Setup MediaRecorder with optimal settings for voice
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 16000 // Optimized for voice
    });
    
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        // Convert to base64 and send immediately for real-time processing
        const reader = new FileReader();
        reader.onload = () => {
          const base64Audio = (reader.result as string).split(',')[1];
          wsRef.current?.send(JSON.stringify({
            type: 'audio_chunk',
            audio: base64Audio,
            timestamp: Date.now()
          }));
        };
        reader.readAsDataURL(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      toast.error('Audio recording error');
    };

    // Setup Voice Activity Detection for natural conversation flow
    vadRef.current = new VoiceActivityDetector(
      () => {
        console.log('Voice activity detected - user started speaking');
        setIsListening(true);
        
        // Interrupt bot speech if user starts talking
        if (isSpeaking && audioRef.current) {
          console.log('Interrupting bot speech - user is talking');
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsSpeaking(false);
        }
      },
      () => {
        console.log('Voice activity ended - user stopped speaking');
        setTimeout(() => setIsListening(false), 500); // Small delay for natural feel
      }
    );

    vadRef.current.initialize(stream);

    // Start continuous recording with small chunks for minimal latency
    console.log('Starting continuous audio streaming...');
    mediaRecorder.start(50); // 50ms chunks for ultra-low latency

    // Monitor recording state
    mediaRecorder.onstart = () => {
      console.log('Audio recording started successfully');
    };

    mediaRecorder.onstop = () => {
      console.log('Audio recording stopped');
    };
  };

  const handleWebSocketMessage = (data: any) => {
    voiceDebugger.log('debug', `Received WebSocket message: ${data.type}`, data);
    console.log('WebSocket message received:', data.type, data);
    
    switch (data.type) {
      case 'connection_ready':
        console.log('WebSocket connection ready');
        break;
        
      case 'session_started':
        console.log('Voice session started:', data.sessionId);
        toast.success(`Voice session started with ${data.botName}`);
        break;
        
      case 'stt_ready':
        console.log('Speech-to-text ready');
        toast.success('Voice recognition ready');
        break;
        
      case 'transcript_update':
        voiceDebugger.incrementCounter('transcriptUpdates');
        // Real-time transcript updates
        setTranscript(data.text);
        if (data.isFinal) {
          setCurrentUserMessage(data.text);
          // Clear transcript after showing final version
          setTimeout(() => {
            setTranscript('');
            setCurrentUserMessage('');
          }, 3000);
        }
        break;
        
      case 'speech_started':
        setIsListening(true);
        // Stop any playing audio when user starts speaking (interruption)
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsSpeaking(false);
        }
        break;
        
      case 'speech_ended':
        setIsListening(false);
        break;
        
      case 'user_message':
        const userMsg = {
          role: 'user' as const,
          content: data.content,
          type: 'user' as const
        };
        onAddMessage(userMsg);
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
        
      case 'processing_error':
      case 'stt_error':
      case 'tts_error':
        voiceDebugger.log('error', 'Voice processing error', data);
        voiceDebugger.incrementCounter('errors');
        console.error('Voice processing error:', data.message);
        toast.error(data.message);
        break;
        
      case 'session_ended':
        console.log('Voice session ended');
        toast.info('Voice session ended');
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const playAudioResponse = (audioData: string) => {
    voiceDebugger.log('info', 'Starting audio playback', { audioSize: audioData.length });
    console.log('Playing audio response, size:', audioData.length);
    setIsSpeaking(true);
    
    try {
      // Create audio element with optimized settings
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      audioRef.current = audio;
      
      // Optimize for low latency playback
      audio.preload = 'auto';
      audio.volume = isMuted ? 0 : 1;
      
      audio.onloadeddata = () => {
        console.log('Audio loaded and ready to play');
      };
      
      audio.onplay = () => {
        console.log('Audio playback started');
      };
      
      audio.onended = () => {
        console.log('Audio playback completed');
        setIsSpeaking(false);
        audioRef.current = null;
      };
      
      audio.onerror = (error) => {
        console.error('Audio playback error:', error);
        setIsSpeaking(false);
        audioRef.current = null;
        toast.error('Audio playback failed');
      };
      
      // Start playback immediately unless muted
      if (!isMuted) {
        audio.play().catch(error => {
          console.error('Error starting audio playback:', error);
          setIsSpeaking(false);
          audioRef.current = null;
        });
      } else {
        console.log('Audio muted - not playing');
        setIsSpeaking(false);
      }
      
    } catch (error) {
      console.error('Error creating audio element:', error);
      setIsSpeaking(false);
      toast.error('Failed to create audio');
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            console.log(voiceDebugger.getPerformanceReport());
            toast.success('Performance report logged to console');
          }}
          className="gap-2"
        >
          📊 Debug
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
              {connecting ? 'Connecting to voice system...' : 
               !isConnected ? 'Click to start real-time voice conversation' :
               isListening ? '🎤 Listening - speak now...' : 
               isSpeaking ? '🔊 Speaking - you can interrupt anytime' : 
               '⭐ Ready - start talking naturally'}
            </p>
            {isConnected && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                Ultra-low latency • Real-time processing • Natural conversation
              </p>
            )}
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