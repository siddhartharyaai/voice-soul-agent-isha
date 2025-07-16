import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  audio_url?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  bot_id: string;
  messages: Message[];
  timestamp: string;
}

export function useConversations(botId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchConversations = async () => {
    if (!botId) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('bot_id', botId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const parsedConversations = (data || []).map(conv => ({
        ...conv,
        messages: Array.isArray(conv.messages) ? conv.messages as unknown as Message[] : []
      }));

      setConversations(parsedConversations);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching conversations",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConversation = async (messages: Message[]) => {
    if (!botId || messages.length === 0) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .insert({
          bot_id: botId,
          messages: messages as any,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      await fetchConversations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error saving conversation",
        description: error.message,
      });
    }
  };

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setCurrentMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const clearCurrentMessages = () => {
    setCurrentMessages([]);
  };

  const exportHistory = () => {
    const allMessages = conversations.flatMap(conv => conv.messages);
    const exportData = {
      exportDate: new Date().toISOString(),
      totalConversations: conversations.length,
      totalMessages: allMessages.length,
      conversations: conversations
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isha-conversations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "History exported",
      description: "Your conversation history has been downloaded.",
    });
  };

  useEffect(() => {
    fetchConversations();
  }, [botId]);

  return {
    conversations,
    currentMessages,
    loading,
    addMessage,
    saveConversation,
    clearCurrentMessages,
    exportHistory,
    refetch: fetchConversations,
  };
}