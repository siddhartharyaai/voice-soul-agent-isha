import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface VoiceVisualizationProps {
  isActive: boolean;
  mode: 'listening' | 'speaking' | 'idle';
  className?: string;
}

export const VoiceVisualization: React.FC<VoiceVisualizationProps> = ({
  isActive,
  mode,
  className
}) => {
  const [audioData, setAudioData] = useState<number[]>(new Array(20).fill(0));

  useEffect(() => {
    if (!isActive) {
      setAudioData(new Array(20).fill(0));
      return;
    }

    const interval = setInterval(() => {
      setAudioData(prev => 
        prev.map(() => {
          const baseHeight = mode === 'speaking' ? 0.3 : 0.1;
          const randomHeight = Math.random() * (mode === 'speaking' ? 0.7 : 0.4);
          return baseHeight + randomHeight;
        })
      );
    }, mode === 'speaking' ? 50 : 100);

    return () => clearInterval(interval);
  }, [isActive, mode]);

  const getModeColor = () => {
    switch (mode) {
      case 'speaking': return 'hsl(var(--speaking))';
      case 'listening': return 'hsl(var(--listening))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  return (
    <div className={cn("flex items-end justify-center space-x-1 h-16", className)}>
      {audioData.map((height, index) => (
        <div
          key={index}
          className="w-1 bg-current transition-all duration-75 ease-out rounded-full"
          style={{
            height: `${height * 100}%`,
            color: getModeColor(),
            opacity: isActive ? 0.8 : 0.3,
            animationDelay: `${index * 0.05}s`
          }}
        />
      ))}
    </div>
  );
};