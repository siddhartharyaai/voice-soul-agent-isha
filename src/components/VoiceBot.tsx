import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Volume2, VolumeX, MessageSquare, Phone, PhoneOff, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceVisualization } from './VoiceVisualization';
import { ChatHistory } from './ChatHistory';
import { SettingsPanel } from './SettingsPanel';
import { MCPServerForm } from './MCPServerForm';
import { WorkflowPanel } from './WorkflowPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Bot } from '@/hooks/useBots';
import type { MCPServer } from '@/hooks/useMCPServers';
import type { Message } from '@/hooks/useConversations';

interface VoiceBotProps {
  botName: string;
  botId: string;
  messages: Message[];
  onAddMessage: (message: Omit<Message, 'timestamp' | 'id'>) => Message;
  onSaveConversation: (messages: Message[]) => Promise<void>;
  activeBot: Bot;
  onUpdateBot: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
  mcpServers: MCPServer[];
}

export function VoiceBot({ botName, botId, messages, onAddMessage, onSaveConversation, activeBot, onUpdateBot, mcpServers }: VoiceBotProps) {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [transcription, setTranscription] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startVoiceSession = async () => {
    try {
      setConnecting(true);
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Start voice session using edge function
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('voice-session', {
        body: {
          action: 'start',
          botId: activeBot.id,
          userId: user.id
        }
      });
      
      if (sessionError) {
        throw new Error(`Session start failed: ${sessionError.message}`);
      }
      
      setSessionId(sessionData.sessionId);
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      setIsListening(true);
      setConnecting(false);
      
      // Start audio recording
      setupAudioRecording(stream);
      
      toast.success('Voice session started');
      
    } catch (error) {
      console.error('Voice session error:', error);
      toast.error('Voice session failed: ' + error.message);
      setConnecting(false);
      setIsListening(false);
    }
  };

  const setupAudioRecording = (stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm'
    });
    
    mediaRecorderRef.current = mediaRecorder;
    mediaStreamRef.current = stream;
    
    let audioChunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      if (audioChunks.length > 0 && user) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onload = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          try {
            // Step 1: Convert speech to text
            const { data: sttData, error: sttError } = await supabase.functions.invoke('speech-to-text', {
              body: { audio: base64Audio }
            });
            
            if (sttError || !sttData.text.trim()) {
              console.log('No speech detected or STT error:', sttError);
              return;
            }
            
            const userMessage = {
              role: 'user' as const,
              content: sttData.text,
              type: 'user' as const
            };
            
            onAddMessage(userMessage);
            setTranscription(sttData.text);
            
            // Step 2: Get AI response
            const conversationHistory = messages.slice(-10); // Last 10 messages for context
            const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-conversation', {
              body: {
                message: sttData.text,
                botId: activeBot.id,
                userId: user.id,
                conversationHistory
              }
            });
            
            if (aiError) {
              throw new Error(`AI response failed: ${aiError.message}`);
            }
            
            const assistantMessage = {
              role: 'assistant' as const,
              content: aiData.response,
              type: 'bot' as const
            };
            
            onAddMessage(assistantMessage);
            
            // Step 3: Convert AI response to speech and play
            if (activeBot.auto_speak) {
              const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
                body: {
                  text: aiData.response,
                  voice: activeBot.voice
                }
              });
              
              if (!ttsError && ttsData.audio) {
                playAudioResponse(ttsData.audio);
              }
            }
            
            // Clear transcription after processing
            setTimeout(() => setTranscription(''), 2000);
            
          } catch (error) {
            console.error('Voice processing error:', error);
            toast.error('Voice processing failed');
          }
        };
        
        reader.readAsDataURL(audioBlob);
      }
      
      audioChunks = [];
    };
    
    // Record in chunks for real-time processing
    const recordChunk = () => {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        setTimeout(() => {
          if (isListening && mediaRecorder.state === 'inactive') {
            mediaRecorder.start();
            setTimeout(recordChunk, 3000); // 3-second chunks
          }
        }, 100);
      }
    };
    
    mediaRecorder.start();
    setTimeout(recordChunk, 3000);
  };

  const stopVoiceSession = async () => {
    try {
      if (sessionId && user) {
        // Save conversation before ending session
        await supabase.functions.invoke('voice-session', {
          body: {
            action: 'save',
            sessionId,
            botId: activeBot.id,
            userId: user.id,
            messages
          }
        });
        
        // End session
        await supabase.functions.invoke('voice-session', {
          body: {
            action: 'end',
            sessionId,
            userId: user.id
          }
        });
      }
    } catch (error) {
      console.error('Error ending voice session:', error);
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsListening(false);
    setConnecting(false);
    setSessionId(null);
    setTranscription('');
    toast.success('Voice session ended');
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
      
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
        setIsSpeaking(false);
      });
    } catch (error) {
      console.error('Error creating audio:', error);
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
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  const handleInputModeToggle = () => {
    setInputMode(inputMode === 'voice' ? 'text' : 'voice');
  };

  const sendTextMessage = async () => {
    if (!textInput.trim() || !user) return;
    
    const userMessage = {
      role: 'user' as const,
      content: textInput,
      type: 'user' as const
    };
    
    onAddMessage(userMessage);
    const currentInput = textInput;
    setTextInput('');
    
    try {
      // Get AI response for text input
      const conversationHistory = messages.slice(-10);
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-conversation', {
        body: {
          message: currentInput,
          botId: activeBot.id,
          userId: user.id,
          conversationHistory
        }
      });
      
      if (aiError) {
        throw new Error(`AI response failed: ${aiError.message}`);
      }
      
      const assistantMessage = {
        role: 'assistant' as const,
        content: aiData.response,
        type: 'bot' as const
      };
      
      onAddMessage(assistantMessage);
      
      // Convert to speech if auto-speak is enabled
      if (activeBot.auto_speak) {
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
          body: {
            text: aiData.response,
            voice: activeBot.voice
          }
        });
        
        if (!ttsError && ttsData.audio) {
          playAudioResponse(ttsData.audio);
        }
      }
      
    } catch (error) {
      console.error('Text message error:', error);
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h1 className="text-xl font-semibold text-foreground">{botName}</h1>
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

      {/* Real-time transcription */}
      {transcription && (
        <div className="px-4 py-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground italic"
          >
            Transcribing: {transcription}
          </motion.div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        {inputMode === 'voice' ? (
          <div className="flex flex-col items-center space-y-4">
            {/* Voice Controls */}
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
                onClick={handleVoiceToggle}
                disabled={connecting}
                size="lg"
                className={`rounded-full w-16 h-16 ${
                  isListening 
                    ? 'bg-destructive hover:bg-destructive/90' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {connecting ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-background border-t-transparent" />
                ) : isListening ? (
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
              isConnected={!!sessionId}
              onToggleListening={handleVoiceToggle}
              onToggleMute={handleMuteToggle}
              onStop={stopVoiceSession}
            />

            {/* Status */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {connecting ? 'Connecting...' : 
                 isListening ? 'Listening...' : 
                 isSpeaking ? 'Speaking...' : 
                 'Click to start voice conversation'}
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
                disabled={!textInput.trim()}
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