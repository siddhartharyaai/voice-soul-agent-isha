import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Trash2, Plus } from 'lucide-react';
import { Bot } from '@/hooks/useBots';
import { useToast } from '@/hooks/use-toast';
import { useMCPServers } from '@/hooks/useMCPServers';
import { MCPServerForm } from '@/components/MCPServerForm';
import { useAuth } from '@/hooks/useAuth';

interface SettingsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeBot: Bot | null;
  onUpdateBot: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
}

export function SettingsPanel({ isOpen, onToggle, activeBot, onUpdateBot }: SettingsPanelProps) {
  const [botName, setBotName] = useState('');
  const [personality, setPersonality] = useState('');
  const [voice, setVoice] = useState('');
  const [model, setModel] = useState('');
  const [wakeWord, setWakeWord] = useState('');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    mcpServers, 
    loading: mcpLoading, 
    updateMCPServer, 
    deleteMCPServer,
    refetch: refetchMCPServers
  } = useMCPServers();

  // Update form when activeBot changes
  useEffect(() => {
    if (activeBot) {
      setBotName(activeBot.name);
      setPersonality(activeBot.personality);
      setVoice(activeBot.voice);
      setModel(activeBot.model);
      setWakeWord(activeBot.wake_word);
      setAutoSpeak(activeBot.auto_speak);
    }
  }, [activeBot]);

  const handleSaveSettings = async () => {
    if (!activeBot) return;
    
    setSaving(true);
    try {
      await onUpdateBot(activeBot.id, {
        name: botName,
        personality,
        voice,
        model,
        wake_word: wakeWord,
        auto_speak: autoSpeak,
      });
      onToggle();
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMcpServer = async (id: string) => {
    try {
      await deleteMCPServer(id);
      toast({
        title: "Server removed",
        description: "MCP server has been deleted successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete MCP server.",
      });
    }
  };

  const handleToggleMcpServer = async (id: string, enabled: boolean) => {
    try {
      await updateMCPServer(id, { enabled });
      toast({
        title: "Server updated",
        description: `MCP server has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive", 
        title: "Error",
        description: "Failed to update MCP server.",
      });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onToggle}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline ml-2">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Bot Settings</SheetTitle>
          <SheetDescription>
            Customize your AI assistant's behavior and appearance
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 py-6">
          {/* Bot Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bot Identity</CardTitle>
              <CardDescription>
                Configure your bot's name and personality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bot-name">Bot Name</Label>
                <Input
                  id="bot-name"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Enter bot name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="personality">Personality</Label>
                <Textarea
                  id="personality"
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Describe your bot's personality..."
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="wake-word">Wake Word</Label>
                <Input
                  id="wake-word"
                  value={wakeWord}
                  onChange={(e) => setWakeWord(e.target.value)}
                  placeholder="Hey Isha"
                />
              </div>
            </CardContent>
          </Card>

          {/* Voice Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Configuration</CardTitle>
              <CardDescription>
                Configure voice and speech settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="voice">Voice Model</Label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aura-2-thalia-en">Thalia (Natural)</SelectItem>
                    <SelectItem value="aura-2-luna-en">Luna (Professional)</SelectItem>
                    <SelectItem value="aura-2-stella-en">Stella (Energetic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                    <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={autoSpeak}
                  onCheckedChange={setAutoSpeak}
                />
                <Label>Auto-speak responses</Label>
              </div>
            </CardContent>
          </Card>

          {/* MCP Servers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">MCP Servers</CardTitle>
              <CardDescription>
                Manage Model Context Protocol integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Connected Servers</span>
                <MCPServerForm onServerAdded={refetchMCPServers} />
              </div>
              
              <div className="space-y-2">
                {mcpLoading ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Loading MCP servers...
                  </div>
                ) : mcpServers.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    No MCP servers configured. Add one to extend your bot's capabilities.
                  </div>
                ) : (
                  mcpServers.map((server) => (
                    <div key={server.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={server.enabled}
                          onCheckedChange={(enabled) => handleToggleMcpServer(server.id, enabled)}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{server.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {server.url}
                          </div>
                          {server.description && (
                            <div className="text-xs text-muted-foreground">
                              {server.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              server.approval_mode === 'always_ask' 
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : server.approval_mode === 'auto_approve'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {server.approval_mode.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMcpServer(server.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
          <Separator />
          
          <div className="flex gap-2">
            <Button 
              onClick={handleSaveSettings} 
              className="flex-1" 
              disabled={saving || !activeBot}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button variant="outline" onClick={onToggle}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}