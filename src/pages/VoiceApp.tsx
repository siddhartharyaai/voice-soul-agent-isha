import { useState, useCallback } from 'react';
import { 
  MessageSquare, 
  Settings, 
  Zap, 
  Keyboard, 
  Mic,
  Send,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { VoiceBot } from '@/components/VoiceBot';
import { ChatHistory } from '@/components/ChatHistory';
import { WorkflowPanel } from '@/components/WorkflowPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { VoiceVisualization } from '@/components/VoiceVisualization';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type VoiceBotState = 'idle' | 'listening' | 'speaking' | 'processing';
type ActivePanel = 'chat' | 'workflows' | 'settings';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  type: 'text' | 'voice';
}

interface BotSettings {
  name: string;
  personality: string;
  voice: string;
  voiceSpeed: number;
  voiceVolume: number;
  model: string;
  autoSpeak: boolean;
  wakeWord: string;
}

interface MCPServer {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  enabled: boolean;
  description: string;
}

export const VoiceApp: React.FC = () => {
  // State
  const [botState, setBotState] = useState<VoiceBotState>('idle');
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: 'Hello! I\'m Isha, your AI assistant. How can I help you today?',
      role: 'assistant',
      timestamp: new Date(),
      type: 'voice'
    }
  ]);

  const [botSettings, setBotSettings] = useState<BotSettings>({
    name: 'Isha',
    personality: 'Helpful, friendly, and knowledgeable AI assistant',
    voice: 'aura-2-thalia-en',
    voiceSpeed: 1.0,
    voiceVolume: 80,
    model: 'gemini-1.5-flash',
    autoSpeak: true,
    wakeWord: 'Hey Isha'
  });

  const [mcpServers, setMcpServers] = useState<MCPServer[]>([
    {
      id: '1',
      name: 'Weather Service',
      url: 'https://api.weather.com/mcp',
      enabled: true,
      description: 'Provides weather information and forecasts'
    },
    {
      id: '2',
      name: 'Calendar Integration',
      url: 'https://api.calendar.com/mcp',
      enabled: false,
      description: 'Manages calendar events and scheduling'
    }
  ]);

  // Handlers
  const handleVoiceToggle = useCallback(() => {
    setIsMuted(!isMuted);
    toast({
      title: isMuted ? "Voice enabled" : "Voice muted",
      description: isMuted ? "Isha can now speak" : "Isha is now muted"
    });
  }, [isMuted]);

  const handleMicToggle = useCallback(() => {
    if (botState === 'listening') {
      setBotState('idle');
      setIsVoiceMode(false);
    } else {
      setBotState('listening');
      setIsVoiceMode(true);
      // Simulate voice activation
      setTimeout(() => {
        setBotState('processing');
        setTimeout(() => {
          setBotState('speaking');
          setTimeout(() => setBotState('idle'), 3000);
        }, 1000);
      }, 2000);
    }
  }, [botState]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: textInput,
      role: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setTextInput('');
    setBotState('processing');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `I understand you said: "${textInput}". How can I help you with that?`,
        role: 'assistant',
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, aiResponse]);
      setBotState('idle');
    }, 1500);
  }, [textInput]);

  const handleWorkflowAction = useCallback((actionId: string) => {
    toast({
      title: "Workflow triggered",
      description: `Executing ${actionId}...`
    });
    setBotState('processing');
    setTimeout(() => setBotState('idle'), 2000);
  }, []);

  const handleConfigureAction = useCallback((actionId: string) => {
    toast({
      title: "Configure workflow",
      description: `Opening configuration for ${actionId}`
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setMessages([]);
    toast({
      title: "History cleared",
      description: "All conversation history has been deleted."
    });
  }, []);

  const handleMCPServerAdd = useCallback((server: Omit<MCPServer, 'id'>) => {
    const newServer: MCPServer = {
      ...server,
      id: Date.now().toString()
    };
    setMcpServers(prev => [...prev, newServer]);
  }, []);

  const handleMCPServerUpdate = useCallback((serverId: string, updates: Partial<MCPServer>) => {
    setMcpServers(prev => 
      prev.map(server => 
        server.id === serverId ? { ...server, ...updates } : server
      )
    );
  }, []);

  const handleMCPServerDelete = useCallback((serverId: string) => {
    setMcpServers(prev => prev.filter(server => server.id !== serverId));
    toast({
      title: "Server removed",
      description: "MCP server has been deleted."
    });
  }, []);

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'chat':
        return (
          <ChatHistory
            messages={messages}
            onClearHistory={handleClearHistory}
          />
        );
      case 'workflows':
        return (
          <WorkflowPanel
            onActionTrigger={handleWorkflowAction}
            onConfigureAction={handleConfigureAction}
          />
        );
      case 'settings':
        return (
          <SettingsPanel
            settings={botSettings}
            mcpServers={mcpServers}
            onSettingsChange={setBotSettings}
            onMCPServerAdd={handleMCPServerAdd}
            onMCPServerUpdate={handleMCPServerUpdate}
            onMCPServerDelete={handleMCPServerDelete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:relative z-50 h-full w-80 bg-card border-r border-border transition-transform duration-200 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full gradient-voice flex items-center justify-center text-white font-bold text-sm">
              {botSettings.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold">{botSettings.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden"
          >
            <X size={20} />
          </Button>
        </div>

        {/* Panel Navigation */}
        <div className="flex border-b border-border">
          {[
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'workflows', icon: Zap, label: 'Workflows' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActivePanel(panel.id as ActivePanel)}
              className={cn(
                "flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors",
                activePanel === panel.id
                  ? "text-primary bg-primary/10 border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <panel.icon size={16} />
              <span className="hidden sm:inline">{panel.label}</span>
            </button>
          ))}
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden">
          {renderActivePanel()}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu size={20} />
          </Button>
          
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-semibold">Voice Assistant</h1>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>

          <div className="flex items-center space-x-2">
            <VoiceVisualization
              isActive={botState !== 'idle'}
              mode={botState === 'speaking' ? 'speaking' : 'listening'}
              className="w-20 h-8"
            />
          </div>
        </header>

        {/* Voice Bot Interface */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            <VoiceBot
              botName={botSettings.name}
              state={botState}
              isVoiceMode={isVoiceMode}
              onVoiceToggle={handleVoiceToggle}
              onMicToggle={handleMicToggle}
              isMuted={isMuted}
            />
          </div>
        </div>

        {/* Text Input */}
        <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
          <Card className="p-3">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVoiceMode(!isVoiceMode)}
                className={cn(
                  "transition-colors",
                  isVoiceMode ? "text-primary" : "text-muted-foreground"
                )}
              >
                {isVoiceMode ? <Mic size={20} /> : <Keyboard size={20} />}
              </Button>
              
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                placeholder={
                  isVoiceMode 
                    ? "Hold to speak or type here..." 
                    : "Type your message..."
                }
                className="flex-1 border-none bg-transparent focus-visible:ring-0"
                disabled={botState === 'processing'}
              />
              
              <Button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || botState === 'processing'}
                size="sm"
              >
                <Send size={16} />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};