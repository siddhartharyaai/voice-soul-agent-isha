import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Key, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Shield,
  Check,
  AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface APIKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: 'gemini' | 'deepgram' | 'perplexity' | 'openai' | 'notion' | 'slack' | 'todoist' | 'github' | 'spotify' | 'google' | null;
  onSave: (service: string, apiKey: string) => Promise<void>;
}

const serviceConfig = {
  gemini: {
    name: 'Google Gemini',
    description: 'Required for AI chat and function calling',
    placeholder: 'Enter your Gemini API key...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    helpText: 'Get your API key from Google AI Studio',
    pattern: /^AIza[0-9A-Za-z-_]{35}$/,
    icon: '🤖'
  },
  deepgram: {
    name: 'Deepgram',
    description: 'Required for speech-to-text and text-to-speech',
    placeholder: 'Enter your Deepgram API key...',
    helpUrl: 'https://console.deepgram.com/project/_/keys',
    helpText: 'Get your API key from Deepgram Console',
    pattern: /^[0-9a-f]{40}$/,
    icon: '🎤'
  },
  perplexity: {
    name: 'Perplexity AI',
    description: 'Optional: Enhanced web search capabilities',
    placeholder: 'Enter your Perplexity API key...',
    helpUrl: 'https://www.perplexity.ai/settings/api',
    helpText: 'Get your API key from Perplexity Settings',
    pattern: /^pplx-[0-9a-f]{56}$/,
    icon: '🔍'
  },
  openai: {
    name: 'OpenAI',
    description: 'Optional: Enhanced AI capabilities',
    placeholder: 'Enter your OpenAI API key...',
    helpUrl: 'https://platform.openai.com/api-keys',
    helpText: 'Get your API key from OpenAI Platform',
    pattern: /^sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}$/,
    icon: '🧠'
  },
  notion: {
    name: 'Notion',
    description: 'Optional: Notion workspace integration',
    placeholder: 'OAuth handled automatically',
    helpUrl: 'https://www.notion.so/my-integrations',
    helpText: 'OAuth consent will be requested when needed',
    pattern: /.*/,
    icon: '📝'
  },
  slack: {
    name: 'Slack',
    description: 'Optional: Slack workspace integration',
    placeholder: 'OAuth handled automatically',
    helpUrl: 'https://api.slack.com/apps',
    helpText: 'OAuth consent will be requested when needed',
    pattern: /.*/,
    icon: '💬'
  },
  todoist: {
    name: 'Todoist',
    description: 'Optional: Task management integration',
    placeholder: 'Enter your Todoist API token...',
    helpUrl: 'https://todoist.com/prefs/integrations',
    helpText: 'Get your API token from Todoist settings',
    pattern: /^[a-f0-9]{40}$/,
    icon: '✅'
  },
  github: {
    name: 'GitHub',
    description: 'Optional: Repository and issue management',
    placeholder: 'OAuth handled automatically',
    helpUrl: 'https://github.com/settings/developers',
    helpText: 'OAuth consent will be requested when needed',
    pattern: /.*/,
    icon: '🐙'
  },
  spotify: {
    name: 'Spotify',
    description: 'Optional: Music control and recommendations',
    placeholder: 'OAuth handled automatically',
    helpUrl: 'https://developer.spotify.com/dashboard',
    helpText: 'OAuth consent will be requested when needed',
    pattern: /.*/,
    icon: '🎵'
  },
  google: {
    name: 'Google OAuth',
    description: 'Required for Calendar and Gmail integration',
    placeholder: 'OAuth handled automatically',
    helpUrl: 'https://console.developers.google.com/',
    helpText: 'OAuth consent will be requested when needed',
    pattern: /.*/,
    icon: '📧'
  }
};

export function APIKeyModal({ isOpen, onClose, service, onSave }: APIKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const { toast } = useToast();

  if (!service) return null;

  const config = serviceConfig[service];

  const validateApiKey = (key: string) => {
    if (!key.trim()) {
      return 'API key is required';
    }
    
    if (service !== 'google' && !config.pattern.test(key)) {
      return `Invalid ${config.name} API key format`;
    }
    
    return '';
  };

  const handleSave = async () => {
    // For OAuth services, initiate OAuth flow
    const oauthServices = ['google', 'notion', 'slack', 'github', 'spotify'];
    
    if (oauthServices.includes(service)) {
      setIsLoading(true);
      try {
        await onSave(service, 'oauth');
        toast({
          title: "OAuth initiated",
          description: `${config.name} OAuth flow has been started`,
        });
        onClose();
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Failed to start OAuth",
          description: error.message || "An error occurred while starting OAuth",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // For API key services, validate and save
    const error = validateApiKey(apiKey);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(service, apiKey);
      toast({
        title: "API key saved",
        description: `${config.name} API key has been securely stored`,
      });
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save API key",
        description: error.message || "An error occurred while saving the API key",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setApiKey(value);
    setValidationError('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{config.icon}</span>
            Setup {config.name}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Security notice */}
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-medium">Secure Storage</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your API key will be encrypted and stored securely in your Supabase backend.
              </p>
            </CardContent>
          </Card>

          {/* API Key Input */}
          {!['google', 'notion', 'slack', 'github', 'spotify'].includes(service) ? (
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder={config.placeholder}
                  value={apiKey}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className={cn(
                    "pr-10",
                    validationError && "border-destructive"
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-8 p-0"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
              
              {validationError && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertTriangle className="w-3 h-3" />
                  {validationError}
                </div>
              )}
              
              {apiKey && !validationError && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="w-3 h-3" />
                  Valid API key format
                </div>
              )}
            </div>
          ) : (
            <Card className="bg-background border border-border">
              <CardContent className="p-4 text-center">
                <div className="text-lg mb-2">🔐</div>
                <p className="text-sm text-muted-foreground">
                  {config.name} OAuth will be initiated automatically when you first use {service} features.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Help link */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{config.helpText}</span>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-auto p-1 text-primary hover:text-primary/80"
            >
              <a 
                href={config.helpUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                Get API Key
                <ExternalLink className="w-3 h-3" />
              </a>
            </Button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {['google', 'notion', 'slack', 'github', 'spotify'].includes(service) ? (
              <Button 
                onClick={handleSave} 
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                Start OAuth
              </Button>
            ) : (
              <Button 
                onClick={handleSave} 
                disabled={isLoading || !apiKey || !!validationError}
                className="gap-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                ) : (
                  <Key className="w-4 h-4" />
                )}
                Save API Key
              </Button>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}