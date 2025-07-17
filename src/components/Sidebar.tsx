import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Plus, 
  Trash2, 
  Download, 
  Menu,
  X,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useConversations } from '@/hooks/useConversations';

interface SidebarProps {
  conversations: any[];
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onExportHistory: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ 
  conversations,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onExportHistory,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {

  
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getConversationPreview = (messages: any[]) => {
    const lastUserMessage = [...messages].reverse().find(m => m.type === 'user');
    return lastUserMessage?.content?.slice(0, 50) + (lastUserMessage?.content?.length > 50 ? '...' : '') || 'New conversation';
  };

  const exportConversation = (conversationId: string) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    const dataStr = JSON.stringify(conversation, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversation-${conversationId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={false}
      animate={{ 
        width: isCollapsed ? '64px' : '320px'
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn(
        "h-full bg-panel border-r border-border z-50 flex flex-col overflow-hidden",
        "hidden lg:flex" // Hidden on mobile, shown on desktop
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-foreground">Chat History</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="shrink-0"
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </Button>
        </div>
        
        {!isCollapsed && (
          <Button
            onClick={onNewConversation}
            className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </Button>
        )}
        
        {isCollapsed && (
          <Button
            onClick={onNewConversation}
            variant="ghost"
            size="sm"
            className="w-full h-10 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "group relative p-3 rounded-lg cursor-pointer transition-all duration-200",
                "hover:bg-muted/50 hover:shadow-sm",
                "bg-background/50"
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              {isCollapsed ? (
                <div className="flex justify-center">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {getConversationPreview(conversation.messages)}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(conversation.timestamp)}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        exportConversation(conversation.id);
                      }}
                      className="h-6 w-6 p-0 hover:bg-muted"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conversation.id);
                      }}
                      className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {conversations.length === 0 && !isCollapsed && (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground/70">Start a new conversation to begin</p>
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}