import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createHash } from "https://deno.land/std@0.208.0/crypto/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

console.log('LiveKit Token Function starting...')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomName, participantName, botId, userId } = await req.json()
    
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')
    const LIVEKIT_WS_URL = Deno.env.get('LIVEKIT_WS_URL')
    
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
      throw new Error('Missing LiveKit configuration')
    }

    console.log('Generating token for room:', roomName, 'participant:', participantName)

    // Create JWT token for LiveKit
    const token = await generateLiveKitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName,
      participantName,
      grants: {
        roomJoin: true,
        roomRecord: false,
        roomAdmin: false,
        roomCreate: false,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
      }
    })

    return new Response(JSON.stringify({
      success: true,
      token,
      url: LIVEKIT_WS_URL,
      roomName,
      participantName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Token generation error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

interface TokenGrants {
  roomJoin: boolean;
  roomRecord: boolean;
  roomAdmin: boolean;
  roomCreate: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  canUpdateOwnMetadata: boolean;
}

interface TokenOptions {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  grants: TokenGrants;
  ttl?: number; // seconds
}

async function generateLiveKitToken(options: TokenOptions): Promise<string> {
  const {
    apiKey,
    apiSecret,
    roomName,
    participantName,
    grants,
    ttl = 3600 // 1 hour default
  } = options;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttl;

  // Create JWT header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Create JWT payload
  const payload = {
    iss: apiKey,
    sub: participantName,
    iat: now,
    exp: exp,
    room: roomName,
    video: {
      room: roomName,
      roomJoin: grants.roomJoin,
      roomRecord: grants.roomRecord,
      roomAdmin: grants.roomAdmin,
      roomCreate: grants.roomCreate,
      canPublish: grants.canPublish,
      canSubscribe: grants.canSubscribe,
      canPublishData: grants.canPublishData,
      canUpdateOwnMetadata: grants.canUpdateOwnMetadata,
    }
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64;
  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  }
  
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}