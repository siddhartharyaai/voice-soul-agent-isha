import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAPIKeys() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const saveAPIKey = useCallback(async (service: string, apiKey: string) => {
    if (apiKey === 'oauth') {
      // Handle OAuth flow
      return initiateOAuth(service);
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/functions/v1/api-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ service, apiKey }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save API key');
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAPIKey = useCallback(async (service: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { exists: false };
      }

      const response = await fetch(`/functions/v1/api-keys?service=${service}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check API key');
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking API key:', error);
      return { exists: false };
    }
  }, []);

  const deleteAPIKey = useCallback(async (service: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/functions/v1/api-keys?service=${service}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const initiateOAuth = useCallback(async (service: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/functions/v1/oauth-handler/initiate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          service,
          redirectUrl: `${window.location.origin}/oauth/callback`
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to initiate OAuth');
      }

      const { authUrl } = await response.json();
      
      // Open OAuth popup
      const popup = window.open(
        authUrl, 
        'oauth', 
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      // Wait for OAuth completion
      return new Promise((resolve, reject) => {
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            resolve({ success: true });
          }
        }, 1000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkClosed);
          popup?.close();
          reject(new Error('OAuth timeout'));
        }, 300000);
      });

    } finally {
      setLoading(false);
    }
  }, []);

  return {
    saveAPIKey,
    checkAPIKey,
    deleteAPIKey,
    loading
  };
}