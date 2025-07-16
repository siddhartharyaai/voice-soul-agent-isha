import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Bot {
  id: string;
  user_id: string;
  name: string;
  personality: string;
  voice: string;
  model: string;
  wake_word: string;
  auto_speak: boolean;
  created_at: string;
}

export function useBots() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [activeBot, setActiveBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBots = async () => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setBots(data || []);
      if (data && data.length > 0 && !activeBot) {
        setActiveBot(data[0]);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching bots",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBot = async (botId: string, updates: Partial<Bot>) => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .update(updates)
        .eq('id', botId)
        .select()
        .single();

      if (error) throw error;

      setBots(prev => prev.map(bot => bot.id === botId ? data : bot));
      if (activeBot?.id === botId) {
        setActiveBot(data);
      }

      toast({
        title: "Bot updated",
        description: "Your bot settings have been saved.",
      });

      return data;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating bot",
        description: error.message,
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  return {
    bots,
    activeBot,
    setActiveBot,
    loading,
    updateBot,
    refetch: fetchBots,
  };
}