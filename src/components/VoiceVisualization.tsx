import { motion } from 'framer-motion';
import { Mic, MicOff, Square, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceVisualizationProps {
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isConnected: boolean;
  onToggleListening: () => void;
  onToggleMute: () => void;
  onStop: () => void;
  className?: string;
}

export function VoiceVisualization({
  isListening,
  isSpeaking,
  isMuted,
  isConnected,
  onToggleListening,
  onToggleMute,
  onStop,
  className
}: VoiceVisualizationProps) {
  const getVoiceState = () => {
    if (!isConnected) return 'disconnected';
    if (isSpeaking) return 'speaking';
    if (isListening) return 'listening';
    return 'idle';
  };

  const voiceState = getVoiceState();

  const getButtonClasses = () => {
    const baseClasses = "relative w-20 h-20 rounded-full border-2 transition-all duration-300 flex items-center justify-center";
    
    switch (voiceState) {
      case 'speaking':
        return cn(baseClasses, "bg-voice-speaking border-voice-speaking text-white shadow-speaking animate-speaking-pulse");
      case 'listening':
        return cn(baseClasses, "bg-voice-listening border-voice-listening text-white shadow-listening animate-listening-pulse");
      case 'idle':
        return cn(baseClasses, "bg-primary border-primary text-primary-foreground shadow-voice hover:scale-105");
      default:
        return cn(baseClasses, "bg-muted border-border text-muted-foreground");
    }
  };

  // Waveform animation data
  const waveformBars = Array.from({ length: 5 }, (_, i) => i);

  return (
    <div className={cn("flex flex-col items-center space-y-4", className)}>
      {/* Waveform Visualization */}
      {(isListening || isSpeaking) && (
        <motion.div 
          className="flex items-center space-x-1 h-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          {waveformBars.map((bar) => (
            <motion.div
              key={bar}
              className={cn(
                "w-1 rounded-full",
                isSpeaking ? "bg-voice-speaking" : "bg-voice-listening"
              )}
              animate={{
                height: [4, 16, 8, 20, 4],
                opacity: [0.4, 1, 0.6, 1, 0.4]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: bar * 0.1,
                ease: "easeInOut"
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Main Voice Button */}
      <motion.button
        onClick={onToggleListening}
        className={getButtonClasses()}
        whileHover={{ scale: isConnected ? 1.05 : 1 }}
        whileTap={{ scale: isConnected ? 0.95 : 1 }}
        disabled={!isConnected}
      >
        {!isConnected ? (
          <MicOff className="w-8 h-8" />
        ) : isListening ? (
          <Mic className="w-8 h-8" />
        ) : (
          <Mic className="w-8 h-8" />
        )}
        
        {/* Animated rings for pulse effect */}
        {isConnected && (isListening || isSpeaking) && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2"
              style={{
                borderColor: isSpeaking ? 'hsl(var(--speaking))' : 'hsl(var(--listening))'
              }}
              animate={{
                scale: [1, 1.5, 2],
                opacity: [0.6, 0.3, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut"
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2"
              style={{
                borderColor: isSpeaking ? 'hsl(var(--speaking))' : 'hsl(var(--listening))'
              }}
              animate={{
                scale: [1, 1.8, 2.5],
                opacity: [0.4, 0.2, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: 0.5,
                ease: "easeOut"
              }}
            />
          </>
        )}
      </motion.button>

      {/* Control Buttons */}
      <div className="flex items-center space-x-4">
        {/* Mute Toggle */}
        <motion.button
          onClick={onToggleMute}
          className={cn(
            "p-3 rounded-full transition-all duration-200",
            isMuted 
              ? "bg-destructive text-destructive-foreground" 
              : "bg-muted hover:bg-muted/80 text-foreground"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={!isConnected}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </motion.button>

        {/* Stop Button */}
        {(isListening || isSpeaking) && (
          <motion.button
            onClick={onStop}
            className="p-3 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Square className="w-5 h-5" />
          </motion.button>
        )}
      </div>

      {/* Status Text */}
      <div className="text-center">
        <motion.p 
          className="text-sm font-medium text-foreground"
          key={voiceState}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {voiceState === 'listening' && 'Listening...'}
          {voiceState === 'speaking' && 'Speaking...'}
          {voiceState === 'idle' && 'Click to speak'}
          {voiceState === 'disconnected' && 'Disconnected'}
        </motion.p>
        
        {isMuted && isConnected && (
          <motion.p 
            className="text-xs text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Audio muted
          </motion.p>
        )}
      </div>
    </div>
  );
}