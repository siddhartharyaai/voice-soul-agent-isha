import { useState } from 'react';
import { 
  Calendar, 
  Mail, 
  Search, 
  StickyNote, 
  CloudSun, 
  Music, 
  Clock,
  Plus,
  Settings,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WorkflowAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  category: 'productivity' | 'communication' | 'information' | 'entertainment';
  enabled: boolean;
  shortcut?: string;
}

interface WorkflowPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function WorkflowPanel({ isOpen, onToggle }: WorkflowPanelProps) {
  const onActionTrigger = (actionId: string) => console.log('Action:', actionId);
  const onConfigureAction = (actionId: string) => console.log('Configure:', actionId);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const workflows: WorkflowAction[] = [
    // Productivity
    {
      id: 'schedule-meeting',
      title: 'Schedule Meeting',
      description: 'Book a meeting with participants',
      icon: Calendar,
      category: 'productivity',
      enabled: true,
      shortcut: 'Cmd+M'
    },
    {
      id: 'take-notes',
      title: 'Take Notes',
      description: 'Create and organize notes',
      icon: StickyNote,
      category: 'productivity',
      enabled: true,
      shortcut: 'Cmd+N'
    },
    {
      id: 'set-reminder',
      title: 'Set Reminder',
      description: 'Create time-based reminders',
      icon: Clock,
      category: 'productivity',
      enabled: true
    },
    
    // Communication
    {
      id: 'send-email',
      title: 'Send Email',
      description: 'Compose and send emails',
      icon: Mail,
      category: 'communication',
      enabled: true,
      shortcut: 'Cmd+E'
    },
    
    // Information
    {
      id: 'web-search',
      title: 'Web Search',
      description: 'Search the internet for information',
      icon: Search,
      category: 'information',
      enabled: true,
      shortcut: 'Cmd+S'
    },
    {
      id: 'weather',
      title: 'Weather',
      description: 'Get current weather and forecasts',
      icon: CloudSun,
      category: 'information',
      enabled: true
    },
    
    // Entertainment
    {
      id: 'play-music',
      title: 'Play Music',
      description: 'Control music playback',
      icon: Music,
      category: 'entertainment',
      enabled: false
    }
  ];

  const categories = [
    { id: 'all', label: 'All', count: workflows.length },
    { id: 'productivity', label: 'Productivity', count: workflows.filter(w => w.category === 'productivity').length },
    { id: 'communication', label: 'Communication', count: workflows.filter(w => w.category === 'communication').length },
    { id: 'information', label: 'Information', count: workflows.filter(w => w.category === 'information').length },
    { id: 'entertainment', label: 'Entertainment', count: workflows.filter(w => w.category === 'entertainment').length }
  ];

  const filteredWorkflows = selectedCategory === 'all' 
    ? workflows 
    : workflows.filter(w => w.category === selectedCategory);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'productivity': return 'hsl(var(--primary))';
      case 'communication': return 'hsl(var(--accent))';
      case 'information': return 'hsl(var(--listening))';
      case 'entertainment': return 'hsl(var(--speaking))';
      default: return 'hsl(var(--muted-foreground))';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Zap size={20} className="text-primary" />
            <h3 className="font-semibold">Workflows</h3>
          </div>
          <Button variant="ghost" size="sm">
            <Plus size={16} />
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="h-8 text-xs"
            >
              {category.label}
              <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-xs">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Workflow Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWorkflows.map((workflow) => {
            const IconComponent = workflow.icon;
            return (
              <Card
                key={workflow.id}
                className={cn(
                  "group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
                  workflow.enabled 
                    ? "hover:border-primary/50 hover:shadow-primary/10" 
                    : "opacity-60 cursor-not-allowed"
                )}
                onClick={() => workflow.enabled && onActionTrigger(workflow.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div
                      className="p-2 rounded-lg transition-colors duration-200"
                      style={{ 
                        backgroundColor: `${getCategoryColor(workflow.category)}20`,
                        color: getCategoryColor(workflow.category)
                      }}
                    >
                      <IconComponent size={20} />
                    </div>
                    <div className="flex items-center space-x-2">
                      {workflow.shortcut && (
                        <Badge variant="outline" className="text-xs">
                          {workflow.shortcut}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onConfigureAction(workflow.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      >
                        <Settings size={12} />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-sm font-medium">{workflow.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {workflow.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant={workflow.enabled ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {workflow.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      {workflow.category}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredWorkflows.length === 0 && (
          <div className="text-center py-8">
            <Zap size={48} className="mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No workflows found</p>
            <p className="text-sm text-muted-foreground/70">Try selecting a different category</p>
          </div>
        )}
      </div>
    </div>
  );
};