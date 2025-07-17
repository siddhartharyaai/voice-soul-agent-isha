import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const service = searchParams.get('service') || 'google';

        if (!code) {
          throw new Error('Authorization code not received');
        }

        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        // Send callback to backend
        const response = await fetch('/functions/v1/oauth-handler/callback', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ service, code, state }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'OAuth callback failed');
        }

        const result = await response.json();
        
        if (result.success) {
          toast({
            title: "OAuth completed",
            description: `${service} integration has been set up successfully`,
          });
          
          // Close popup if this is running in a popup
          if (window.opener) {
            window.close();
          } else {
            navigate('/voice');
          }
        } else {
          throw new Error('OAuth callback failed');
        }

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        toast({
          variant: "destructive",
          title: "OAuth failed",
          description: error.message || "Failed to complete OAuth flow",
        });

        // Close popup or redirect
        if (window.opener) {
          window.close();
        } else {
          navigate('/voice');
        }
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold mb-2">Completing OAuth...</h2>
        <p className="text-muted-foreground">Please wait while we finalize your integration.</p>
      </div>
    </div>
  );
}