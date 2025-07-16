import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { VoiceVisualization } from './VoiceVisualization';
import { Message } from '@/hooks/useConversations';

interface VoiceBotProps {
  botName: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  onSaveConversation: (messages: Message[]) => void;
}

export function VoiceBot({ botName, messages, onAddMessage, onSaveConversation }: VoiceBotProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');

  const handleVoiceToggle = () => {
    setIsListening(!isListening);
    if (!isListening) {
      // Start listening
      onAddMessage({
        type: 'user',
        content: 'Voice input activated',
      });
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
            className="w-16 h-16 rounded-full"
          >
            {isListening ? <Mic className="h-8 w-8" /> : <MicOff className="h-8 w-8" />}
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