import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface APIKeyRequest {
  service: string
  apiKey: string
}

// Simple encryption using built-in crypto
async function encrypt(text: string, key: string): Promise<string> {
  const keyData = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(text)
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

async function decrypt(encryptedText: string, key: string): Promise<string> {
  const keyData = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32))
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  const combined = new Uint8Array(
    atob(encryptedText).split('').map(char => char.charCodeAt(0))
  )
  
  const iv = combined.slice(0, 12)
  const encrypted = combined.slice(12)
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  )
  
  return new TextDecoder().decode(decrypted)
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

    // Create Supabase client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response('Invalid token', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    const url = new URL(req.url)
    const service = url.searchParams.get('service')

    if (req.method === 'GET') {
      if (!service) {
        return new Response('Service parameter required', { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      // Get API key for service
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data, error } = await adminSupabase
        .from('user_api_keys')
        .select('encrypted_data')
        .eq('user_id', user.id)
        .eq('service', service)
        .maybeSingle()

      if (error) {
        console.error('Database error:', error)
        return new Response('Database error', { 
          status: 500, 
          headers: corsHeaders 
        })
      }

      if (!data) {
        return new Response(JSON.stringify({ exists: false }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Decrypt and return existence (not the actual key for security)
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key'
      try {
        await decrypt(data.encrypted_data, encryptionKey)
        return new Response(JSON.stringify({ exists: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch {
        return new Response(JSON.stringify({ exists: false }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    if (req.method === 'POST') {
      const { service, apiKey }: APIKeyRequest = await req.json()

      if (!service || !apiKey) {
        return new Response('Service and apiKey required', { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      // Validate API key format
      const patterns: { [key: string]: RegExp } = {
        gemini: /^AIza[0-9A-Za-z-_]{35}$/,
        deepgram: /^[0-9a-f]{40}$/,
        perplexity: /^pplx-[0-9a-f]{56}$/,
        openai: /^sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}$/,
      }

      if (patterns[service] && !patterns[service].test(apiKey)) {
        return new Response(`Invalid ${service} API key format`, { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      // Encrypt API key
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-key'
      const encryptedKey = await encrypt(apiKey, encryptionKey)

      // Save to database using service role
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)
      const { error } = await adminSupabase
        .from('user_api_keys')
        .upsert({
          user_id: user.id,
          service,
          encrypted_data: encryptedKey,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Database error:', error)
        return new Response('Failed to save API key', { 
          status: 500, 
          headers: corsHeaders 
        })
      }

      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'DELETE') {
      if (!service) {
        return new Response('Service parameter required', { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey)
      const { error } = await adminSupabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', user.id)
        .eq('service', service)

      if (error) {
        console.error('Database error:', error)
        return new Response('Failed to delete API key', { 
          status: 500, 
          headers: corsHeaders 
        })
      }

      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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