import { useState } from 'react';
import { MessageCircle, Trash2, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  type: 'text' | 'voice';
}

interface ChatHistoryProps {
  messages: ChatMessage[];
  onClearHistory: () => void;
  onMessageSelect?: (messageId: string) => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  messages,
  onClearHistory,
  onMessageSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMessages = messages.filter(message =>
    message.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const groupedMessages = filteredMessages.reduce((groups, message) => {
    const dateKey = formatDate(message.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <MessageCircle size={20} className="text-primary" />
          <h3 className="font-semibold">Conversation History</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearHistory}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {Object.keys(groupedMessages).length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle size={48} className="mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground/70">Start chatting with Isha!</p>
            </div>
          ) : (
            Object.entries(groupedMessages).map(([date, dayMessages]) => (
              <div key={date} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Clock size={14} />
                  <span>{date}</span>
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {dayMessages.map((message) => (
                    <div
                      key={message.id}
                      onClick={() => onMessageSelect?.(message.id)}
                      className={cn(
                        "group flex items-start space-x-3 p-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-muted/50",
                        message.role === 'user' 
                          ? "ml-8" 
                          : "mr-8"
                      )}
                    >
                      {/* Avatar */}
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0",
                          message.role === 'user'
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-accent-foreground"
                        )}
                      >
                        {message.role === 'user' ? 'U' : 'I'}
                      </div>

                      {/* Message Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium">
                            {message.role === 'user' ? 'You' : 'Isha'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.timestamp)}
                          </span>
                          {message.type === 'voice' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                        </div>
                        <p className="text-sm text-foreground/90 line-clamp-3">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};