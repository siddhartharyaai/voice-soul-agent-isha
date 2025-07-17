import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VoiceBot } from '@/components/VoiceBot';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useBots } from '@/hooks/useBots';
import { useConversations } from '@/hooks/useConversations';
import { useMCPServers } from '@/hooks/useMCPServers';
import { useAPIKeys } from '@/hooks/useAPIKeys';

export default function VoiceApp() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const { user, loading: authLoading } = useAuth();
  const { activeBot, updateBot, loading: botsLoading } = useBots();
  const { currentMessages, addMessage, saveConversation, exportHistory, clearCurrentMessages, conversations } = useConversations(activeBot?.id);
  const { mcpServers } = useMCPServers();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || botsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading your assistant...</p>
        </motion.div>
      </div>
    );
  }

  if (!user || !activeBot) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex w-full">
      {/* Sidebar */}
      <Sidebar 
        conversations={conversations}
        onNewConversation={clearCurrentMessages}
        onSelectConversation={(id) => {
          // TODO: Load conversation by ID
          console.log('Loading conversation:', id);
        }}
        onDeleteConversation={(id) => {
          // TODO: Delete conversation by ID
          console.log('Deleting conversation:', id);
        }}
        onExportHistory={exportHistory}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <VoiceBot 
          botName={activeBot.name}
          botId={activeBot.id}
          messages={currentMessages}
          onAddMessage={addMessage}
          onSaveConversation={saveConversation}
          activeBot={activeBot}
          onUpdateBot={updateBot}
          mcpServers={mcpServers}
        />
      </div>
    </div>
  );
}