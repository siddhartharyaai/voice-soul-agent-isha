import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, botId, userId, sessionId, messages } = await req.json()
    
    if (!action || !userId) {
      throw new Error('Missing required fields: action, userId')
    }

    // Get Supabase client with service role for full access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (action === 'start') {
      if (!botId) {
        throw new Error('Missing botId for session start')
      }

      // Verify bot exists and belongs to user
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single()

      if (botError || !bot) {
        throw new Error('Bot not found or access denied')
      }

      return new Response(
        JSON.stringify({ 
          status: 'started',
          sessionId: `session_${Date.now()}`,
          bot: bot
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'save' && sessionId && messages) {
      // Save conversation to database
      const { error: saveError } = await supabase
        .from('conversations')
        .insert({
          bot_id: botId,
          user_id: userId,
          messages: messages,
        })

      if (saveError) {
        console.error('Error saving conversation:', saveError)
        throw new Error('Failed to save conversation')
      }

      return new Response(
        JSON.stringify({ status: 'saved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'end') {
      return new Response(
        JSON.stringify({ status: 'ended' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Invalid action')

  } catch (error) {
    console.error('Voice Session Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})