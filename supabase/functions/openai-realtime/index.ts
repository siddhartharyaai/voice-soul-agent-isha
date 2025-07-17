import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Voice chat function starting...')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req
  const upgradeHeader = headers.get("upgrade") || ""

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)
  
  // Get API keys - use Deepgram and Gemini instead of OpenAI
  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
  
  console.log('API Keys check:', { deepgram: !!DEEPGRAM_API_KEY, gemini: !!GEMINI_API_KEY })
  
  if (!DEEPGRAM_API_KEY || !GEMINI_API_KEY) {
    console.error('Missing API keys')
    socket.close(1000, 'Missing API keys')
    return response
  }

  let deepgramSocket: WebSocket | null = null
  let botConfig: any = null
  let conversationHistory: any[] = []
  let currentSession: any = null

  // Create Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  socket.onopen = () => {
    console.log('Client WebSocket connection established')
    socket.send(JSON.stringify({ type: 'connection_ready' }))
  }

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('Received from client:', data.type)
      
      switch (data.type) {
        case 'start_session':
          await handleStartSession(data)
          break
        case 'audio_chunk':
          if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN && data.audio) {
            // Decode and forward to Deepgram
            const binaryAudio = atob(data.audio)
            const audioBuffer = new Uint8Array(binaryAudio.length)
            for (let i = 0; i < binaryAudio.length; i++) {
              audioBuffer[i] = binaryAudio.charCodeAt(i)
            }
            deepgramSocket.send(audioBuffer)
          }
          break
        case 'stop_session':
          await handleStopSession()
          break
        default:
          console.log('Unknown client message type:', data.type)
      }
    } catch (error) {
      console.error('Error processing client message:', error)
      socket.send(JSON.stringify({
        type: 'processing_error',
        message: error.message
      }))
    }
  }

  socket.onclose = () => {
    console.log('Client WebSocket connection closed')
    if (deepgramSocket) {
      deepgramSocket.close()
    }
  }

  async function handleStartSession(data: any) {
    console.log('Starting session...', data)
    
    try {
      // Get bot configuration
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', data.botId)
        .eq('user_id', data.userId)
        .single()

      if (botError || !bot) {
        throw new Error('Bot not found or access denied')
      }

      botConfig = bot
      currentSession = {
        sessionId: crypto.randomUUID(),
        botId: data.botId,
        userId: data.userId,
        startTime: new Date().toISOString()
      }

      console.log('Bot loaded:', bot.name)

      // Connect to Deepgram for STT
      const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&endpointing=300&utterance_end_ms=1000`
      
      deepgramSocket = new WebSocket(deepgramUrl, [
        'token',
        DEEPGRAM_API_KEY
      ])

      deepgramSocket.onopen = () => {
        console.log('Connected to Deepgram')
        socket.send(JSON.stringify({
          type: 'session_started',
          sessionId: currentSession.sessionId,
          botName: bot.name
        }))
      }

      deepgramSocket.onmessage = async (event) => {
        try {
          const result = JSON.parse(event.data)
          
          if (result.channel?.alternatives?.[0]) {
            const transcript = result.channel.alternatives[0].transcript
            const isFinal = result.is_final
            
            if (transcript.trim()) {
              socket.send(JSON.stringify({
                type: 'transcript_update',
                text: transcript,
                isFinal: isFinal
              }))

              if (isFinal && transcript.trim().length > 2) {
                await processUserMessage(transcript)
              }
            }
          }
        } catch (error) {
          console.error('Deepgram processing error:', error)
        }
      }

      deepgramSocket.onerror = (error) => {
        console.error('Deepgram error:', error)
        socket.send(JSON.stringify({
          type: 'stt_error',
          message: 'Speech recognition error'
        }))
      }

    } catch (error) {
      console.error('Error starting session:', error)
      socket.send(JSON.stringify({
        type: 'session_error',
        message: `Failed to start session: ${error.message}`
      }))
    }
  }

  async function processUserMessage(transcript: string) {
    try {
      console.log('Processing:', transcript)
      
      conversationHistory.push({
        role: 'user',
        content: transcript
      })

      socket.send(JSON.stringify({
        type: 'user_message',
        content: transcript
      }))

      // Generate AI response with Gemini
      const systemPrompt = `You are ${botConfig.name}. ${botConfig.personality || 'You are a helpful AI assistant.'} Keep responses conversational and concise for voice interaction.`
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nUser: ${transcript}\n\nAssistant:`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100,
          },
        }),
      })

      const result = await response.json()
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I had trouble responding.'

      conversationHistory.push({
        role: 'assistant',
        content: aiResponse
      })

      socket.send(JSON.stringify({
        type: 'ai_response',
        content: aiResponse
      }))

      // Generate speech with Deepgram TTS
      if (botConfig.auto_speak) {
        await generateSpeech(aiResponse)
      }

    } catch (error) {
      console.error('Error processing message:', error)
      socket.send(JSON.stringify({
        type: 'processing_error',
        message: 'Failed to process message'
      }))
    }
  }

  async function generateSpeech(text: string) {
    try {
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      const arrayBuffer = await response.arrayBuffer()
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      socket.send(JSON.stringify({
        type: 'audio_response',
        audio: base64Audio
      }))

    } catch (error) {
      console.error('TTS Error:', error)
      socket.send(JSON.stringify({
        type: 'tts_error',
        message: 'Failed to generate speech'
      }))
    }
  }

  async function handleStopSession() {
    if (deepgramSocket) {
      deepgramSocket.close()
    }
    socket.send(JSON.stringify({ type: 'session_ended' }))
  }

  return response
})