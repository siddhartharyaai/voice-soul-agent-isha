import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { VoiceBot } from '@/components/VoiceBot';
import { ChatHistory } from '@/components/ChatHistory';
import { WorkflowPanel } from '@/components/WorkflowPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useAuth } from '@/hooks/useAuth';
import { useBots } from '@/hooks/useBots';
import { useConversations } from '@/hooks/useConversations';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function VoiceApp() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(false);
  
  const { user, loading: authLoading, signOut } = useAuth();
  const { activeBot, updateBot, loading: botsLoading } = useBots();
  const { currentMessages, addMessage, saveConversation, exportHistory, clearCurrentMessages } = useConversations(activeBot?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (authLoading || botsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading your assistant...</p>
        </div>
      </div>
    );
  }

  if (!user || !activeBot) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="container mx-auto p-4 h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {activeBot.name} Voice Assistant
            </h1>
            <div className="text-sm text-muted-foreground">
              Welcome, {user.email}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportHistory}
              className="hidden sm:flex"
            >
              Export History
            </Button>
            <WorkflowPanel 
              isOpen={isWorkflowOpen}
              onToggle={() => setIsWorkflowOpen(!isWorkflowOpen)}
            />
            <SettingsPanel 
              isOpen={isSettingsOpen}
              onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
              activeBot={activeBot}
              onUpdateBot={updateBot}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Voice Bot Section */}
          <div className="lg:col-span-2 flex flex-col">
            <VoiceBot 
              botName={activeBot.name}
              messages={currentMessages}
              onAddMessage={addMessage}
              onSaveConversation={saveConversation}
            />
          </div>

          {/* Chat History Section */}
          <div className="flex flex-col">
            <ChatHistory 
              messages={currentMessages}
              onClearMessages={clearCurrentMessages}
            />
          </div>
        </div>
      </div>
    </div>
  );
}