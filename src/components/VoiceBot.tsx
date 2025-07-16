import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, MessageSquare, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { VoiceVisualization } from './VoiceVisualization';
import { Message } from '@/hooks/useConversations';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface VoiceBotProps {
  botName: string;
  botId: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  onSaveConversation: (messages: Message[]) => void;
}

export function VoiceBot({ botName, botId, messages, onAddMessage, onSaveConversation }: VoiceBotProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [isConnecting, setIsConnecting] = useState(false);
  const [voiceSession, setVoiceSession] = useState<any>(null);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const backendUrl = 'http://localhost:8000'; // Backend URL

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
    if (!user || !botId) return;
    
    setIsConnecting(true);
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Start voice session with backend
      const response = await fetch(`${backendUrl}/api/voice-session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          bot_id: botId
        })
      });

      if (!response.ok) throw new Error('Failed to start voice session');
      
      const sessionData = await response.json();
      setVoiceSession(sessionData);

      // Connect WebSocket
      const ws = new WebSocket(`ws://localhost:8000/ws/${sessionData.session_id}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
        toast({
          title: "Voice session started",
          description: "You can now speak to your assistant",
        });
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'response') {
          // Add bot response to messages
          onAddMessage({
            type: 'bot',
            content: data.text,
          });
          
          // Play audio if available
          if (data.audio && !isMuted) {
            playAudioResponse(data.audio);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          variant: "destructive",
          title: "Connection error",
          description: "Failed to maintain voice connection",
        });
      };

      ws.onclose = () => {
        setIsListening(false);
        setIsSpeaking(false);
      };

      // Setup audio recording
      setupAudioRecording(stream);
      
    } catch (error: any) {
      console.error('Error starting voice session:', error);
      toast({
        variant: "destructive",
        title: "Voice session failed",
        description: error.message || "Failed to start voice session",
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

  return (
    <Card className="h-full flex flex-col shadow-lg border-border/50">
      <CardContent className="p-8 text-center space-y-6">
        {/* Bot Avatar/Visualization */}
        <div className="relative mx-auto">
          <VoiceVisualization 
            isActive={isListening || isSpeaking}
            mode={isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle'}
          />
        </div>

        {/* Bot Status */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{botName}</h2>
          <p className="text-muted-foreground">
            {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready to chat'}
          </p>
        </div>

        {/* Voice Controls */}
        <div className="flex justify-center gap-4">
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="lg"
            onClick={handleMuteToggle}
            className="w-14 h-14 rounded-full"
          >
            {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
          </Button>
          
          <Button
            variant={isListening ? "default" : "outline"}
            size="lg"
            onClick={handleVoiceToggle}
            disabled={isConnecting}
            className="w-16 h-16 rounded-full"
          >
            {isConnecting ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isListening ? (
              <Mic className="h-8 w-8" />
            ) : (
              <MicOff className="h-8 w-8" />
            )}
          </Button>
          
          <Button
            variant={inputMode === 'text' ? "default" : "outline"}
            size="lg"
            onClick={handleInputModeToggle}
            className="w-14 h-14 rounded-full"
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="flex justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-accent animate-pulse' : 'bg-muted'}`} />
          <div className={`w-2 h-2 rounded-full ${inputMode === 'text' ? 'bg-secondary animate-pulse' : 'bg-muted'}`} />
        </div>
      </CardContent>
    </Card>
  );
}