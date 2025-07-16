import { useState } from 'react';
import { 
  User, 
  Mic, 
  Volume2, 
  Brain, 
  Palette,
  Server,
  Plus,
  Settings as SettingsIcon,
  Save,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

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

interface SettingsPanelProps {
  settings: BotSettings;
  mcpServers: MCPServer[];
  onSettingsChange: (settings: BotSettings) => void;
  onMCPServerAdd: (server: Omit<MCPServer, 'id'>) => void;
  onMCPServerUpdate: (serverId: string, server: Partial<MCPServer>) => void;
  onMCPServerDelete: (serverId: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  mcpServers,
  onSettingsChange,
  onMCPServerAdd,
  onMCPServerUpdate,
  onMCPServerDelete
}) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    apiKey: '',
    description: '',
    enabled: true
  });
  const [showAddServer, setShowAddServer] = useState(false);

  const voices = [
    { id: 'aura-2-thalia-en', name: 'Thalia (Deepgram)', description: 'Natural, friendly voice' },
    { id: 'aura-2-luna-en', name: 'Luna (Deepgram)', description: 'Calm, professional voice' },
    { id: 'aura-2-stella-en', name: 'Stella (Deepgram)', description: 'Energetic, expressive voice' }
  ];

  const models = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast, efficient model' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable model' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', description: 'Latest experimental model' }
  ];

  const handleSaveSettings = () => {
    onSettingsChange(localSettings);
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated."
    });
  };

  const handleResetSettings = () => {
    setLocalSettings(settings);
    toast({
      title: "Settings reset",
      description: "Settings have been restored to last saved state."
    });
  };

  const handleAddMCPServer = () => {
    if (!newServer.name || !newServer.url) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    onMCPServerAdd(newServer);
    setNewServer({ name: '', url: '', apiKey: '', description: '', enabled: true });
    setShowAddServer(false);
    toast({
      title: "MCP Server added",
      description: `${newServer.name} has been added successfully.`
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <SettingsIcon size={20} className="text-primary" />
          <h3 className="font-semibold">Settings</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={handleResetSettings}>
            <RotateCcw size={16} />
          </Button>
          <Button size="sm" onClick={handleSaveSettings}>
            <Save size={16} />
            Save
          </Button>
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="bot" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="bot">Bot</TabsTrigger>
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          {/* Bot Settings */}
          <TabsContent value="bot" className="p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User size={20} />
                  <span>Bot Identity</span>
                </CardTitle>
                <CardDescription>
                  Customize your AI assistant's name and personality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bot-name">Bot Name</Label>
                  <Input
                    id="bot-name"
                    value={localSettings.name}
                    onChange={(e) => setLocalSettings({ ...localSettings, name: e.target.value })}
                    placeholder="Enter bot name..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personality">Personality</Label>
                  <Textarea
                    id="personality"
                    value={localSettings.personality}
                    onChange={(e) => setLocalSettings({ ...localSettings, personality: e.target.value })}
                    placeholder="Describe your bot's personality..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wake-word">Wake Word</Label>
                  <Input
                    id="wake-word"
                    value={localSettings.wakeWord}
                    onChange={(e) => setLocalSettings({ ...localSettings, wakeWord: e.target.value })}
                    placeholder="Hey Isha"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Voice Settings */}
          <TabsContent value="voice" className="p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mic size={20} />
                  <span>Voice Configuration</span>
                </CardTitle>
                <CardDescription>
                  Configure voice synthesis and audio settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Voice Model</Label>
                  <Select 
                    value={localSettings.voice} 
                    onValueChange={(value) => setLocalSettings({ ...localSettings, voice: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select voice..." />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex flex-col items-start">
                            <span>{voice.name}</span>
                            <span className="text-xs text-muted-foreground">{voice.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Voice Speed: {localSettings.voiceSpeed}x</Label>
                  <Slider
                    value={[localSettings.voiceSpeed]}
                    onValueChange={([value]) => setLocalSettings({ ...localSettings, voiceSpeed: value })}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Voice Volume: {localSettings.voiceVolume}%</Label>
                  <Slider
                    value={[localSettings.voiceVolume]}
                    onValueChange={([value]) => setLocalSettings({ ...localSettings, voiceVolume: value })}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={localSettings.autoSpeak}
                    onCheckedChange={(checked) => setLocalSettings({ ...localSettings, autoSpeak: checked })}
                  />
                  <Label>Auto-speak responses</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Model Settings */}
          <TabsContent value="model" className="p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain size={20} />
                  <span>AI Model</span>
                </CardTitle>
                <CardDescription>
                  Choose the AI model for conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Language Model</Label>
                  <Select 
                    value={localSettings.model} 
                    onValueChange={(value) => setLocalSettings({ ...localSettings, model: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col items-start">
                            <span>{model.name}</span>
                            <span className="text-xs text-muted-foreground">{model.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MCP Settings */}
          <TabsContent value="mcp" className="p-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server size={20} />
                  <span>MCP Servers</span>
                </CardTitle>
                <CardDescription>
                  Manage Model Context Protocol servers for extended capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Connected Servers</h4>
                  <Button 
                    size="sm" 
                    onClick={() => setShowAddServer(!showAddServer)}
                  >
                    <Plus size={16} />
                    Add Server
                  </Button>
                </div>

                {showAddServer && (
                  <Card className="p-4 bg-muted/20">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Server Name</Label>
                          <Input
                            value={newServer.name}
                            onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                            placeholder="My Custom Server"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Server URL</Label>
                          <Input
                            value={newServer.url}
                            onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                            placeholder="https://api.example.com"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>API Key (Optional)</Label>
                        <Input
                          type="password"
                          value={newServer.apiKey}
                          onChange={(e) => setNewServer({ ...newServer, apiKey: e.target.value })}
                          placeholder="Your API key..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={newServer.description}
                          onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
                          placeholder="What does this server do?"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button onClick={handleAddMCPServer}>Add Server</Button>
                        <Button variant="ghost" onClick={() => setShowAddServer(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="space-y-3">
                  {mcpServers.map((server) => (
                    <Card key={server.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h5 className="font-medium">{server.name}</h5>
                            <Badge variant={server.enabled ? "default" : "secondary"}>
                              {server.enabled ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {server.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {server.url}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={server.enabled}
                            onCheckedChange={(checked) => 
                              onMCPServerUpdate(server.id, { enabled: checked })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onMCPServerDelete(server.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {mcpServers.length === 0 && (
                    <div className="text-center py-8">
                      <Server size={48} className="mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No MCP servers configured</p>
                      <p className="text-sm text-muted-foreground/70">
                        Add servers to extend Isha's capabilities
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};