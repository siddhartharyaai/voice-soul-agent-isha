import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChatHistory } from './ChatHistory';
import { VoiceVisualization } from './VoiceVisualization';
import type { Bot } from '@/hooks/useBots';
import type { Message } from '@/hooks/useConversations';

// LiveKit React components
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useDataChannel,
} from '@livekit/components-react';
import { ConnectionState } from 'livekit-client';

interface LiveKitVoiceChatProps {
  botName: string;
  botId: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'timestamp' | 'id'>) => Message;
  onSaveConversation: (messages: Message[]) => Promise<void>;
  activeBot: Bot;
  onUpdateBot: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
}

export function LiveKitVoiceChat({ 
  botName, 
  botId, 
  messages, 
  onAddMessage, 
  onSaveConversation, 
  activeBot, 
  onUpdateBot
}: LiveKitVoiceChatProps) {
  const [liveKitUrl, setLiveKitUrl] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();

  // Generate LiveKit token and room
  const initializeLiveKit = useCallback(async () => {
    setIsConnecting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const generatedRoomName = `voice-session-${botId}-${user.id}-${Date.now()}`;
      const participantName = user.email || user.id;

      console.log('🎤 Initializing LiveKit session...');
      
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          roomName: generatedRoomName,
          participantName,
          botId,
          userId: user.id
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to create LiveKit session');
      }

      console.log('✅ LiveKit token generated:', data);
      
      setLiveKitUrl(data.url);
      setToken(data.token);
      setRoomName(data.roomName);

      toast({
        title: "Connected",
        description: `Voice session started with ${botName}`,
      });

    } catch (error) {
      console.error('❌ Failed to initialize LiveKit:', error);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Failed to start voice session",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [botId, botName, toast]);

  const disconnectSession = useCallback(() => {
    setLiveKitUrl('');
    setToken('');
    setRoomName('');
    toast({
      title: "Disconnected",
      description: "Voice session ended",
    });
  }, [toast]);

  // If we have connection details, render the LiveKit room
  if (liveKitUrl && token) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background/95 to-primary/5">
        <LiveKitRoom
          token={token}
          serverUrl={liveKitUrl}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={disconnectSession}
          className="flex-1"
        >
          <VoiceAssistantInterface
            botName={botName}
            messages={messages}
            onAddMessage={onAddMessage}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(!isMuted)}
            onDisconnect={disconnectSession}
          />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    );
  }

  // Connection screen
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{botName}</h1>
          <Badge variant="secondary">⚫ Disconnected</Badge>
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-hidden">
        <ChatHistory messages={messages} onClearMessages={() => {}} />
      </div>

      {/* Connection Controls */}
      <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
        <div className="flex items-center justify-center">
          <Button
            onClick={initializeLiveKit}
            disabled={isConnecting}
            size="lg"
            className="flex items-center gap-2"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="h-5 w-5" />
                Start Voice Call
              </>
            )}
          </Button>
        </div>
        
        <div className="text-center mt-4 text-sm text-muted-foreground">
          <p>Click to start a real-time voice conversation with {botName}</p>
          <p className="text-xs mt-1">Powered by LiveKit Cloud + Deepgram + Gemini 2.0 Flash</p>
        </div>
      </div>
    </div>
  );
}

// Voice Assistant Interface (inside LiveKit room)
function VoiceAssistantInterface({ 
  botName, 
  messages, 
  onAddMessage, 
  isMuted, 
  onMuteToggle, 
  onDisconnect 
}: {
  botName: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'timestamp' | 'id'>) => Message;
  isMuted: boolean;
  onMuteToggle: () => void;
  onDisconnect: () => void;
}) {
  const connectionState = useConnectionState();
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  
  // Listen for data channel messages (transcripts, responses)
  useDataChannel('voice-data', (message) => {
    try {
      let messageText: string;
      if (typeof message === 'string') {
        messageText = message;
      } else if (message.payload) {
        messageText = new TextDecoder().decode(message.payload);
      } else {
        console.warn('Unknown message format:', message);
        return;
      }
      
      const data = JSON.parse(messageText);
      
      if (data.type === 'transcript' && data.text?.trim()) {
        onAddMessage({
          content: data.text,
          type: 'user'
        });
      } else if (data.type === 'ai_response' && data.text?.trim()) {
        onAddMessage({
          content: data.text,
          type: 'bot'
        });
      }
    } catch (error) {
      console.error('Error parsing data channel message:', error);
    }
  });

  const isConnected = connectionState === ConnectionState.Connected;
  const isSpeaking = voiceState === 'speaking';
  const isListening = voiceState === 'listening';

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{botName}</h1>
          <div className="flex gap-2">
            <Badge 
              variant={isConnected ? 'default' : 'secondary'}
              className="mb-2"
            >
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
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
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-hidden">
        <ChatHistory messages={messages} onClearMessages={() => {}} />
      </div>

      {/* Voice Controls */}
      <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-4">
          <Button
            onClick={onDisconnect}
            variant="destructive"
            size="lg"
            className="flex-1"
          >
            <PhoneOff className="h-5 w-5 mr-2" />
            End Call
          </Button>

          <Button
            onClick={onMuteToggle}
            variant="outline"
            size="lg"
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        </div>

        {/* Voice Visualization */}
        <div className="space-y-4">
          <VoiceVisualization 
            isListening={isListening} 
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            isConnected={isConnected}
            onToggleListening={() => setVoiceState(voiceState === 'listening' ? 'idle' : 'listening')}
            onToggleMute={onMuteToggle}
            onStop={onDisconnect}
          />
          
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {isListening && !isSpeaking ? "👂 Listening for speech..." : 
               isSpeaking ? "🔊 AI Speaking..." : 
               isConnected ? "💬 Ready to chat" : "🔌 Connecting..."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}