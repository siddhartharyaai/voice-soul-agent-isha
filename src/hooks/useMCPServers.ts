import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface MCPServer {
  id: string;
  user_id: string;
  name: string;
  url: string;
  enabled: boolean;
  api_key?: string;
  approval_mode: string;
  description?: string;
  created_at: string;
}

export function useMCPServers() {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchMCPServers = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('mcp_servers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMcpServers(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching MCP servers",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const addMCPServer = async (serverData: Omit<MCPServer, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('mcp_servers')
        .insert({
          ...serverData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setMcpServers(prev => [...prev, data]);
      
      toast({
        title: "MCP Server added",
        description: `${serverData.name} has been added successfully.`,
      });

      return data;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding MCP server",
        description: error.message,
      });
      throw error;
    }
  };

  const updateMCPServer = async (serverId: string, updates: Partial<MCPServer>) => {
    try {
      const { data, error } = await supabase
        .from('mcp_servers')
        .update(updates)
        .eq('id', serverId)
        .select()
        .single();

      if (error) throw error;

      setMcpServers(prev => prev.map(server => 
        server.id === serverId ? data : server
      ));

      toast({
        title: "MCP Server updated",
        description: "Server settings have been saved.",
      });

      return data;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating MCP server",
        description: error.message,
      });
      throw error;
    }
  };

  const deleteMCPServer = async (serverId: string) => {
    try {
      const { error } = await supabase
        .from('mcp_servers')
        .delete()
        .eq('id', serverId);

      if (error) throw error;

      setMcpServers(prev => prev.filter(server => server.id !== serverId));
      
      toast({
        title: "MCP Server deleted",
        description: "Server has been removed successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting MCP server",
        description: error.message,
      });
      throw error;
    }
  };

  const toggleMCPServer = async (serverId: string, enabled: boolean) => {
    return updateMCPServer(serverId, { enabled });
  };

  useEffect(() => {
    fetchMCPServers();
  }, [user]);

  return {
    mcpServers,
    loading,
    addMCPServer,
    updateMCPServer,
    deleteMCPServer,
    toggleMCPServer,
    refetch: fetchMCPServers,
  };
}