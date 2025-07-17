import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Server } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMCPServers } from '@/hooks/useMCPServers';
import { useToast } from '@/hooks/use-toast';

interface MCPServerFormProps {
  onServerAdded?: () => void;
}

export function MCPServerForm({ onServerAdded }: MCPServerFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [description, setDescription] = useState('');
  const [approvalMode, setApprovalMode] = useState('always_ask');
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const { addMCPServer } = useMCPServers();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name || !url) return;

    setIsSubmitting(true);
    try {
      await addMCPServer({
        name,
        url,
        api_key: apiKey || null,
        description: description || null,
        approval_mode: approvalMode,
        enabled,
      });

      toast({
        title: "MCP Server Added",
        description: `${name} has been successfully configured.`,
      });

      // Reset form
      setName('');
      setUrl('');
      setApiKey('');
      setDescription('');
      setApprovalMode('always_ask');
      setEnabled(true);
      setIsOpen(false);
      onServerAdded?.();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add MCP server. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetServers = [
    {
      name: "Activepieces Workflow",
      url: "https://cloud.activepieces.com/api/v1/mcp/VFOtpFDiYPOViCjhZ6rjN/sse",
      description: "Custom workflow automation server",
      approvalMode: "always_ask"
    },
    {
      name: "Notion Integration",
      url: "https://api.notion.com/v1/mcp",
      description: "Notion pages and databases",
      approvalMode: "auto_approve"
    },
    {
      name: "Slack Integration",
      url: "https://slack.com/api/mcp",
      description: "Slack messaging and channels",
      approvalMode: "always_ask"
    },
    {
      name: "Todoist Tasks",
      url: "https://api.todoist.com/mcp",
      description: "Task and project management",
      approvalMode: "auto_approve"
    }
  ];

  const fillPreset = (preset: typeof presetServers[0]) => {
    setName(preset.name);
    setUrl(preset.url);
    setDescription(preset.description);
    setApprovalMode(preset.approvalMode);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add MCP Server
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add MCP Server</DialogTitle>
          <DialogDescription>
            Connect a Model Context Protocol server to extend your bot's capabilities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Setup Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Setup</CardTitle>
              <CardDescription>
                Choose from popular integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {presetServers.map((preset, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => fillPreset(preset)}
                    className="justify-start text-left h-auto p-3"
                  >
                    <div>
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Manual Configuration */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="server-name">Server Name *</Label>
                <Input
                  id="server-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Custom Server"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-mode">Approval Mode</Label>
                <Select value={approvalMode} onValueChange={setApprovalMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always_ask">Always Ask</SelectItem>
                    <SelectItem value="auto_approve">Auto Approve</SelectItem>
                    <SelectItem value="never">Never Execute</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-url">Server URL *</Label>
              <Input
                id="server-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/mcp"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key (Optional)</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key if required"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this server provides..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label>Enable server immediately</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !name || !url}
                className="flex-1"
              >
                {isSubmitting ? 'Adding...' : 'Add Server'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}