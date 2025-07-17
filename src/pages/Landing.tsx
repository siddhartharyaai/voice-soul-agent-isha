import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Play, 
  Mic, 
  Brain, 
  Shield, 
  Zap, 
  Users, 
  ChevronRight,
  Star,
  Lock,
  Sparkles,
  MessageSquare,
  Settings,
  CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

export default function Landing() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/voice');
    } else {
      navigate('/auth');
    }
  };

  const features = [
    {
      icon: Mic,
      title: "Natural Voice Conversations",
      description: "Advanced speech recognition and natural language processing for seamless voice interactions"
    },
    {
      icon: Brain,
      title: "AI-Powered Intelligence", 
      description: "Powered by Google Gemini for intelligent responses and context understanding"
    },
    {
      icon: Settings,
      title: "MCP Integrations",
      description: "Connect to productivity tools like Notion, Slack, Calendar, and more with approval controls"
    },
    {
      icon: Shield,
      title: "Privacy & Security",
      description: "End-to-end encryption for your data with granular permission controls"
    },
    {
      icon: Zap,
      title: "Real-time Performance",
      description: "Low-latency voice processing with real-time transcription and responses"
    },
    {
      icon: Users,
      title: "Multi-language Support",
      description: "Automatic language detection and support for multiple languages"
    }
  ];

  const useCases = [
    "Schedule meetings and manage calendar",
    "Take notes and organize thoughts", 
    "Search the web and get summaries",
    "Control smart home devices",
    "Get weather and news updates",
    "Manage tasks and productivity workflows"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Isha</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <ThemeToggle />
              {user ? (
                <Button onClick={() => navigate('/voice')} className="gap-2">
                  Open App <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={() => navigate('/auth')} variant="outline">
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-6">
                Your AI Voice
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent block">
                  Assistant
                </span>
              </h1>
              
              <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
                Experience the future of AI interaction with natural voice conversations, 
                intelligent automation, and seamless productivity integrations.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  onClick={handleGetStarted}
                  className="gap-2 text-lg px-8 py-6 h-auto"
                >
                  <Mic className="w-5 h-5" />
                  Start Voice Chat
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setIsVideoPlaying(true)}
                  className="gap-2 text-lg px-8 py-6 h-auto"
                >
                  <Play className="w-5 h-5" />
                  Watch Demo
                </Button>
              </div>
            </motion.div>

            {/* Demo Video Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-16"
            >
              <div className="relative max-w-4xl mx-auto">
                <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border/40 overflow-hidden">
                  {isVideoPlaying ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                          <Play className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-muted-foreground">Demo video would play here</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => setIsVideoPlaying(true)}>
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors">
                          <Play className="w-10 h-10 text-primary ml-1" />
                        </div>
                        <p className="text-lg text-foreground font-medium">Watch Isha in Action</p>
                        <p className="text-muted-foreground">See how voice AI can transform your workflow</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-b from-background to-background/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built with cutting-edge AI technology for the most natural and productive voice experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow border-border/40">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                What You Can Do
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Isha integrates with your favorite tools to help you be more productive
              </p>
              
              <div className="space-y-4">
                {useCases.map((useCase, index) => (
                  <motion.div
                    key={useCase}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{useCase}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border/40 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-primary mx-auto mb-4" />
                  <p className="text-lg text-foreground font-medium">Interactive Demo</p>
                  <p className="text-muted-foreground">Try "Add meeting to calendar"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-gradient-to-b from-background/50 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-3xl mx-auto">
            <Lock className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Privacy & Security First
            </h2>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Your conversations and data are encrypted end-to-end. You control what Isha can access 
              with granular permissions for each integration. No data is stored unnecessarily.
            </p>
            <div className="flex flex-wrap gap-4 justify-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                End-to-End Encryption
              </span>
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Zero Data Retention
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Granular Permissions
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-3xl p-12 border border-border/40"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Ready to Transform Your Productivity?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Join thousands of users who are already using AI voice assistants to get more done.
            </p>
            <Button 
              size="lg" 
              onClick={handleGetStarted}
              className="gap-2 text-lg px-8 py-6 h-auto"
            >
              <Mic className="w-5 h-5" />
              Start Free Today
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Isha</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Your intelligent voice assistant for productivity and automation
            </p>
            <div className="flex justify-center items-center gap-6 text-sm text-muted-foreground">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Support</span>
            </div>
            <div className="mt-6 text-sm text-muted-foreground">
              © 2024 Isha AI. Built with ❤️ for productivity.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}