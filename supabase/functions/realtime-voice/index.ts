import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

console.log('LiveKit Voice Session Manager starting...')

serve(async (req) => {
  console.log('Request received:', req.method, req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { botId, userId } = await req.json()
    
    console.log('Creating LiveKit session for bot:', botId, 'user:', userId)
    
    // Get environment variables
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')
    const LIVEKIT_WS_URL = Deno.env.get('LIVEKIT_WS_URL')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    
    console.log('Environment check:', { 
      livekit_key: !!LIVEKIT_API_KEY,
      livekit_secret: !!LIVEKIT_API_SECRET,
      livekit_url: !!LIVEKIT_WS_URL,
      supabase_url: !!SUPABASE_URL,
      supabase_key: !!SUPABASE_ANON_KEY
    })
    
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
      throw new Error('Missing LiveKit credentials')
    }

    // Create Supabase client for bot verification
    const supabase = createClient(
      SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY ?? ''
    )

    // Verify bot exists and user has access
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .eq('user_id', userId)
      .single()

    if (botError || !bot) {
      console.error('Bot verification failed:', botError)
      throw new Error('Bot not found or access denied')
    }

    console.log('Bot verified:', bot.name)

    // Generate LiveKit access token
    const roomName = `voice-chat-${botId}-${userId}-${Date.now()}`
    const participantName = `user-${userId}`
    
    // Create JWT token for LiveKit
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    }
    
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      iss: LIVEKIT_API_KEY,
      sub: participantName,
      iat: now,
      exp: now + 3600, // 1 hour
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true
      }
    }

    // Simple JWT encoding (for demo - use proper JWT library in production)
    const base64UrlEncode = (obj: any) => {
      return btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    }

    const encodedHeader = base64UrlEncode(header)
    const encodedPayload = base64UrlEncode(payload)
    
    // Create signature
    const encoder = new TextEncoder()
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`)
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(LIVEKIT_API_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, data)
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    const accessToken = `${encodedHeader}.${encodedPayload}.${encodedSignature}`

    console.log('LiveKit token generated for room:', roomName)

    // Return LiveKit connection details
    return new Response(JSON.stringify({
      success: true,
      livekit: {
        url: LIVEKIT_WS_URL,
        token: accessToken,
        roomName: roomName,
        participantName: participantName
      },
      bot: {
        id: bot.id,
        name: bot.name,
        personality: bot.personality,
        voice: bot.voice,
        model: bot.model
      },
      sessionId: crypto.randomUUID()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Session creation error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})