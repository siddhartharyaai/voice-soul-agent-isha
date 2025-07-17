import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface OAuthRequest {
  service: string
  redirectUrl?: string
}

interface OAuthCallback {
  service: string
  code: string
  state?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Authorization header missing', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify user token (using service role for token verification)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response('Invalid token', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const url = new URL(req.url)
    
    if (req.method === 'POST' && url.pathname.endsWith('/initiate')) {
      const { service, redirectUrl }: OAuthRequest = await req.json()

      if (!service) {
        return new Response('Service required', { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      let authUrl = ''
      const state = `${user.id}-${Date.now()}`
      const baseRedirectUrl = redirectUrl || `${url.origin}/oauth/callback`

      switch (service) {
        case 'google':
          const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')
          if (!googleClientId) {
            return new Response('Google OAuth not configured', { 
              status: 500, 
              headers: corsHeaders 
            })
          }
          
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${googleClientId}&` +
            `redirect_uri=${encodeURIComponent(baseRedirectUrl)}&` +
            `scope=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly')}&` +
            `response_type=code&` +
            `state=${encodeURIComponent(state)}&` +
            `access_type=offline&` +
            `prompt=consent`
          break

        case 'notion':
          const notionClientId = Deno.env.get('NOTION_CLIENT_ID')
          if (!notionClientId) {
            return new Response('Notion OAuth not configured', { 
              status: 500, 
              headers: corsHeaders 
            })
          }
          
          authUrl = `https://api.notion.com/v1/oauth/authorize?` +
            `client_id=${notionClientId}&` +
            `redirect_uri=${encodeURIComponent(baseRedirectUrl)}&` +
            `response_type=code&` +
            `state=${encodeURIComponent(state)}`
          break

        case 'slack':
          const slackClientId = Deno.env.get('SLACK_CLIENT_ID')
          if (!slackClientId) {
            return new Response('Slack OAuth not configured', { 
              status: 500, 
              headers: corsHeaders 
            })
          }
          
          authUrl = `https://slack.com/oauth/v2/authorize?` +
            `client_id=${slackClientId}&` +
            `redirect_uri=${encodeURIComponent(baseRedirectUrl)}&` +
            `scope=${encodeURIComponent('channels:read chat:write files:read')}&` +
            `state=${encodeURIComponent(state)}`
          break

        case 'github':
          const githubClientId = Deno.env.get('GITHUB_CLIENT_ID')
          if (!githubClientId) {
            return new Response('GitHub OAuth not configured', { 
              status: 500, 
              headers: corsHeaders 
            })
          }
          
          authUrl = `https://github.com/login/oauth/authorize?` +
            `client_id=${githubClientId}&` +
            `redirect_uri=${encodeURIComponent(baseRedirectUrl)}&` +
            `scope=${encodeURIComponent('repo user')}&` +
            `state=${encodeURIComponent(state)}`
          break

        default:
          return new Response('Unsupported service', { 
            status: 400, 
            headers: corsHeaders 
          })
      }

      return new Response(JSON.stringify({ 
        authUrl,
        state 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST' && url.pathname.endsWith('/callback')) {
      const { service, code, state }: OAuthCallback = await req.json()

      if (!service || !code) {
        return new Response('Service and code required', { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      // Verify state contains user ID
      if (state && !state.startsWith(user.id)) {
        return new Response('Invalid state parameter', { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      let tokens = null
      
      switch (service) {
        case 'google':
          const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')
          const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
          
          if (!googleClientId || !googleClientSecret) {
            return new Response('Google OAuth not configured', { 
              status: 500, 
              headers: corsHeaders 
            })
          }

          const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: googleClientId,
              client_secret: googleClientSecret,
              code,
              grant_type: 'authorization_code',
              redirect_uri: `${url.origin}/oauth/callback`
            })
          })
          
          tokens = await googleResponse.json()
          break

        case 'notion':
          const notionClientId = Deno.env.get('NOTION_CLIENT_ID')
          const notionClientSecret = Deno.env.get('NOTION_CLIENT_SECRET')
          
          if (!notionClientId || !notionClientSecret) {
            return new Response('Notion OAuth not configured', { 
              status: 500, 
              headers: corsHeaders 
            })
          }

          const notionResponse = await fetch('https://api.notion.com/v1/oauth/token', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Basic ${btoa(`${notionClientId}:${notionClientSecret}`)}`
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              code,
              redirect_uri: `${url.origin}/oauth/callback`
            })
          })
          
          tokens = await notionResponse.json()
          break

        default:
          return new Response('Token exchange not implemented for this service', { 
            status: 400, 
            headers: corsHeaders 
          })
      }

      if (tokens && tokens.access_token) {
        // Encrypt and store tokens
        const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key'
        const encryptedTokens = await encryptObject(tokens, encryptionKey)

        // Save to user_tokens table
        const { error } = await supabase
          .from('user_tokens')
          .upsert({
            user_id: user.id,
            service,
            tokens: encryptedTokens,
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('Database error:', error)
          return new Response('Failed to save tokens', { 
            status: 500, 
            headers: corsHeaders 
          })
        }

        return new Response(JSON.stringify({ 
          success: true,
          service 
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response('Failed to exchange code for tokens', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

async function encryptObject(obj: any, key: string): Promise<any> {
  const keyData = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  const jsonString = JSON.stringify(obj)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(jsonString)
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return {
    encrypted: btoa(String.fromCharCode(...combined)),
    algorithm: 'AES-GCM'
  }
}