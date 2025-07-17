import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Trash2, 
  Plus, 
  Bot as BotIcon, 
  Server, 
  Key, 
  Play,
  Volume2,
  X
} from 'lucide-react';
import { Bot } from '@/hooks/useBots';
import { useToast } from '@/hooks/use-toast';
import { useMCPServers } from '@/hooks/useMCPServers';
import { MCPServerForm } from '@/components/MCPServerForm';
import { useAuth } from '@/hooks/useAuth';

interface SettingsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowAPIKeyModal?: (service: 'gemini' | 'deepgram' | 'perplexity' | 'google') => void;
  activeBot?: Bot | null;
  onUpdateBot?: (botId: string, updates: Partial<Bot>) => Promise<Bot>;
}

export function SettingsPanel({ isOpen, onToggle, onShowAPIKeyModal, activeBot, onUpdateBot }: SettingsPanelProps) {
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

  const handleTestVoice = (voiceId: string) => {
    // TODO: Implement voice preview using Deepgram TTS
    toast({
      title: "Voice Preview",
      description: `Testing voice: ${voiceId}`,
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onToggle}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>
                Configure your assistant and integrations
              </SheetDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-6"
        >
          <Tabs defaultValue="bot" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bot" className="flex items-center gap-2">
                <BotIcon className="w-4 h-4" />
                Bot
              </TabsTrigger>
              <TabsTrigger value="mcp" className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                MCP Servers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bot" className="space-y-6 mt-6">
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
                    <div className="flex gap-2">
                      <Select value={voice} onValueChange={setVoice}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select voice" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aura-2-thalia-en">
                            <div className="flex items-center justify-between w-full">
                              <span>Thalia</span>
                              <Badge variant="outline" className="ml-2 text-xs">Natural</Badge>
                            </div>
                          </SelectItem>
                          <SelectItem value="aura-2-luna-en">
                            <div className="flex items-center justify-between w-full">
                              <span>Luna</span>
                              <Badge variant="outline" className="ml-2 text-xs">Professional</Badge>
                            </div>
                          </SelectItem>
                          <SelectItem value="aura-2-stella-en">
                            <div className="flex items-center justify-between w-full">
                              <span>Stella</span>
                              <Badge variant="outline" className="ml-2 text-xs">Energetic</Badge>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestVoice(voice)}
                        disabled={!voice}
                        className="shrink-0"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="model">AI Model</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-2.0-flash">
                          <div className="flex items-center justify-between w-full">
                            <span>Gemini 2.0 Flash</span>
                            <Badge className="ml-2 text-xs">Recommended</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
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

              {/* API Keys */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">API Configuration</CardTitle>
                  <CardDescription>
                    Manage API keys for external services
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onShowAPIKeyModal?.('gemini')}
                      className="justify-start gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Gemini API
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onShowAPIKeyModal?.('deepgram')}
                      className="justify-start gap-2"
                    >
                      <Volume2 className="w-4 h-4" />
                      Deepgram
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onShowAPIKeyModal?.('perplexity')}
                      className="justify-start gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Perplexity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onShowAPIKeyModal?.('google')}
                      className="justify-start gap-2"
                    >
                      <Key className="w-4 h-4" />
                      Google OAuth
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mcp" className="space-y-6 mt-6">
              {/* MCP Servers */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">MCP Servers</CardTitle>
                      <CardDescription>
                        Manage Model Context Protocol integrations
                      </CardDescription>
                    </div>
                    <MCPServerForm onServerAdded={refetchMCPServers} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {mcpLoading ? (
                      <div className="text-sm text-muted-foreground text-center py-8">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        Loading MCP servers...
                      </div>
                    ) : mcpServers.length === 0 ? (
                      <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                        <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No MCP servers configured</p>
                        <p className="text-xs text-muted-foreground/70">Add one to extend your bot's capabilities</p>
                      </div>
                    ) : (
                      mcpServers.map((server) => (
                        <motion.div
                          key={server.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <Switch
                              checked={server.enabled}
                              onCheckedChange={(enabled) => handleToggleMcpServer(server.id, enabled)}
                            />
                            <div className="flex-1 min-w-0">
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
                                <Badge
                                  variant={server.approval_mode === 'always_ask' 
                                    ? 'secondary' 
                                    : server.approval_mode === 'auto_approve'
                                    ? 'default'
                                    : 'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {server.approval_mode.replace('_', ' ')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMcpServer(server.id)}
                            className="text-destructive hover:text-destructive shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {activeBot && (
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSaveSettings} 
                className="flex-1" 
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
              <Button variant="outline" onClick={onToggle}>
                Cancel
              </Button>
            </div>
          )}
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}