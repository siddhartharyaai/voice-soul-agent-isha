import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Copy, 
  Share2, 
  Bot, 
  User, 
  Clock,
  ChevronDown,
  ChevronUp,
  Wrench,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  input?: any;
  output?: any;
  error?: string;
}

interface ChatBubbleProps {
  message: {
    id: string;
    type: 'user' | 'bot';
    content: string;
    timestamp: string;
    toolCalls?: ToolCall[];
  };
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const [showToolDetails, setShowToolDetails] = useState(false);
  const { toast } = useToast();

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({
        title: "Copied to clipboard",
        description: "Message content copied successfully",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Could not copy message to clipboard",
      });
    }
  };

  const shareMessage = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Isha Voice Assistant',
          text: message.content,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      copyToClipboard();
    }
  };

  const getToolStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />;
    }
  };

  const getToolStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-500 border-green-500/20 bg-green-500/10';
      case 'error':
        return 'text-red-500 border-red-500/20 bg-red-500/10';
      default:
        return 'text-yellow-500 border-yellow-500/20 bg-yellow-500/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        "flex gap-3 max-w-3xl",
        message.type === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      {/* Avatar */}
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
        message.type === 'user' 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted text-muted-foreground"
      )}>
        {message.type === 'user' ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex flex-col",
        message.type === 'user' ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "group relative px-4 py-3 rounded-2xl max-w-lg",
          "transition-all duration-200 hover:shadow-md",
          message.type === 'user'
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md"
        )}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>

          {/* Action buttons */}
          <div className={cn(
            "absolute -bottom-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
            message.type === 'user' ? "left-2" : "right-2"
          )}>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm hover:bg-background"
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={shareMessage}
              className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm hover:bg-background"
            >
              <Share2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 w-full max-w-lg"
          >
            <Card className="bg-background/50 border border-border/50">
              <CardContent className="p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToolDetails(!showToolDetails)}
                  className="w-full justify-between h-auto p-2"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {message.toolCalls.length} tool call{message.toolCalls.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {showToolDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>

                {/* Tool summary */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {message.toolCalls.map((tool) => (
                    <Badge
                      key={tool.id}
                      variant="outline"
                      className={cn("text-xs", getToolStatusColor(tool.status))}
                    >
                      <span className="flex items-center gap-1">
                        {getToolStatusIcon(tool.status)}
                        {tool.name}
                      </span>
                    </Badge>
                  ))}
                </div>

                {/* Tool details */}
                {showToolDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 space-y-2"
                  >
                    {message.toolCalls.map((tool) => (
                      <div
                        key={tool.id}
                        className="p-2 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{tool.name}</span>
                          <Badge variant="outline" className={getToolStatusColor(tool.status)}>
                            {tool.status}
                          </Badge>
                        </div>
                        
                        {tool.input && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Input:</span>{' '}
                            {typeof tool.input === 'string' 
                              ? tool.input 
                              : JSON.stringify(tool.input)
                            }
                          </div>
                        )}
                        
                        {tool.output && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Output:</span>{' '}
                            {typeof tool.output === 'string' 
                              ? tool.output 
                              : JSON.stringify(tool.output)
                            }
                          </div>
                        )}
                        
                        {tool.error && (
                          <div className="text-xs text-red-400 mt-1">
                            <span className="font-medium">Error:</span> {tool.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </motion.div>
  );
}