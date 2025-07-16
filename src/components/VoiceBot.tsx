import { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

type VoiceBotState = 'idle' | 'listening' | 'speaking' | 'processing';

interface VoiceBotProps {
  botName: string;
  state: VoiceBotState;
  isVoiceMode: boolean;
  onVoiceToggle: () => void;
  onMicToggle: () => void;
  isMuted: boolean;
}

export const VoiceBot: React.FC<VoiceBotProps> = ({
  botName,
  state,
  isVoiceMode,
  onVoiceToggle,
  onMicToggle,
  isMuted
}) => {
  const [waveCount, setWaveCount] = useState(3);

  useEffect(() => {
    if (state === 'speaking') {
      setWaveCount(5);
    } else if (state === 'listening') {
      setWaveCount(4);
    } else {
      setWaveCount(3);
    }
  }, [state]);

  const getStateColor = () => {
    switch (state) {
      case 'speaking': return 'hsl(var(--speaking))';
      case 'listening': return 'hsl(var(--listening))';
      case 'processing': return 'hsl(var(--accent))';
      default: return 'hsl(var(--primary))';
    }
  };

  const getAnimationClass = () => {
    switch (state) {
      case 'speaking': return 'animate-speaking-pulse';
      case 'listening': return 'animate-listening-pulse';
      default: return 'animate-voice-pulse';
    }
  };

  const renderWaves = () => {
    return Array.from({ length: waveCount }, (_, i) => (
      <div
        key={i}
        className={cn(
          "absolute rounded-full border-2 opacity-20",
          state === 'speaking' && "animate-speaking-pulse",
          state === 'listening' && "animate-listening-pulse",
          state === 'idle' && "animate-voice-pulse"
        )}
        style={{
          width: `${120 + (i * 40)}%`,
          height: `${120 + (i * 40)}%`,
          borderColor: getStateColor(),
          animationDelay: `${i * 0.2}s`,
        }}
      />
    ));
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Bot Avatar with Waves */}
      <div className="relative flex items-center justify-center">
        {/* Animated Waves */}
        <div className="absolute inset-0 flex items-center justify-center">
          {renderWaves()}
        </div>
        
        {/* Main Bot Circle */}
        <div
          className={cn(
            "relative z-10 w-32 h-32 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-300 shadow-lg",
            getAnimationClass()
          )}
          style={{
            background: `linear-gradient(135deg, ${getStateColor()}, hsl(var(--accent)))`,
            boxShadow: `0 0 40px ${getStateColor()}33`,
          }}
        >
          <span className="text-white select-none">
            {botName.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Bot Name and State */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">{botName}</h2>
        <p className="text-sm text-muted-foreground capitalize">
          {state === 'processing' ? 'Thinking...' : state}
        </p>
      </div>

      {/* Voice Controls */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onVoiceToggle}
          className={cn(
            "p-3 rounded-full transition-all duration-200 hover:scale-105",
            isMuted 
              ? "bg-destructive/20 text-destructive hover:bg-destructive/30" 
              : "bg-primary/20 text-primary hover:bg-primary/30"
          )}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>

        <button
          onClick={onMicToggle}
          className={cn(
            "p-4 rounded-full transition-all duration-200 hover:scale-105 shadow-lg",
            isVoiceMode
              ? state === 'listening' 
                ? "bg-listening text-black shadow-listening"
                : "bg-primary text-primary-foreground shadow-voice"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {isVoiceMode && state !== 'idle' ? <Mic size={24} /> : <MicOff size={24} />}
        </button>
      </div>

      {/* State Indicator */}
      {state !== 'idle' && (
        <div className="flex items-center space-x-2 text-sm">
          <div 
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: getStateColor() }}
          />
          <span className="text-muted-foreground">
            {state === 'listening' && 'Listening...'}
            {state === 'speaking' && 'Speaking...'}
            {state === 'processing' && 'Processing...'}
          </span>
        </div>
      )}
    </div>
  );
};