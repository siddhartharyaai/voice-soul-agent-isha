import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

console.log('Realtime voice function starting...')

serve(async (req) => {
  console.log('Request received:', req.method, req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight')
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req
  const upgradeHeader = headers.get("upgrade") || ""
  
  console.log('Headers:', Object.fromEntries(headers.entries()))
  console.log('Upgrade header:', upgradeHeader)

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('Not a WebSocket request')
    return new Response("Expected WebSocket connection", { 
      status: 400,
      headers: corsHeaders 
    })
  }

  console.log('Attempting WebSocket upgrade...')
  const { socket, response } = Deno.upgradeWebSocket(req)
  console.log('WebSocket upgrade successful')
  
  // Get environment variables
  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  
  console.log('Environment check:', { 
    deepgram: !!DEEPGRAM_API_KEY, 
    gemini: !!GEMINI_API_KEY,
    supabase_url: !!SUPABASE_URL,
    supabase_key: !!SUPABASE_ANON_KEY
  })
  
  if (!DEEPGRAM_API_KEY || !GEMINI_API_KEY) {
    console.error('Missing required API keys')
    socket.close(1000, 'Missing API keys')
    return response
  }

  let isListening = false
  let currentSession = null
  let conversationHistory: any[] = []
  let botConfig = null
  let deepgramSocket: WebSocket | null = null
  let isProcessing = false

  // Create Supabase client
  const supabase = createClient(
    SUPABASE_URL ?? '',
    SUPABASE_ANON_KEY ?? ''
  )

  console.log('Supabase client created successfully')

  socket.onopen = () => {
    console.log('WebSocket connection opened - ready for real-time voice')
    socket.send(JSON.stringify({
      type: 'connection_ready',
      message: 'WebSocket connected successfully'
    }))
  }

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('Received message:', data.type)
      
      switch (data.type) {
        case 'start_session':
          await handleStartSession(data)
          break
        case 'audio_chunk':
          await handleAudioChunk(data)
          break
        case 'interrupt':
          console.log('Received interrupt signal')
          // Handle interruption - stop current TTS playback
          socket.send(JSON.stringify({
            type: 'interrupted',
            timestamp: new Date().toISOString()
          }))
          break
        case 'text_message':
          await processUserMessage(data.text)
          break
        case 'stop_session':
          await handleStopSession()
          break
        default:
          console.log('Unknown message type:', data.type)
      }
    } catch (error) {
      console.error('Error processing message:', error)
      socket.send(JSON.stringify({
        type: 'processing_error',
        message: error.message
      }))
    }
  }

  socket.onclose = () => {
    console.log('WebSocket connection closed')
    if (deepgramSocket) {
      deepgramSocket.close()
    }
  }

  socket.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  async function handleStartSession(data: any) {
    const { botId, userId, accessToken } = data
    
    console.log('Starting session for bot:', botId, 'user:', userId)
    
    // Validate auth token if provided
    if (accessToken) {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser(accessToken)
        if (authError || !authData.user) {
          console.error('Auth validation failed:', authError)
          socket.send(JSON.stringify({ type: 'auth_error', message: 'Invalid session' }))
          return
        }
        console.log('User authenticated:', authData.user.id)
      } catch (error) {
        console.error('Auth check error:', error)
      }
    }
    console.log('Starting session for bot:', botId, 'user:', userId)
    
    try {
      // Get bot configuration
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single()

      if (botError || !bot) {
        console.error('Bot not found:', botError)
        throw new Error('Bot not found or access denied')
      }

      botConfig = bot
      currentSession = {
        sessionId: crypto.randomUUID(),
        botId,
        userId,
        startTime: new Date().toISOString()
      }

      console.log('Bot config loaded:', bot.name)

      // Initialize Deepgram streaming STT
      initializeDeepgramStreaming()

      socket.send(JSON.stringify({
        type: 'session_started',
        sessionId: currentSession.sessionId,
        botName: bot.name
      }))

    } catch (error) {
      console.error('Session start error:', error)
      socket.send(JSON.stringify({
        type: 'session_error',
        message: `Failed to start session: ${error.message}`
      }))
    }
  }

  function initializeDeepgramStreaming() {
    const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&endpointing=300&utterance_end_ms=1000&vad_events=true`
    
    console.log('Connecting to Deepgram streaming STT...')
    deepgramSocket = new WebSocket(deepgramUrl, [
      'token',
      DEEPGRAM_API_KEY
    ])

    deepgramSocket.onopen = () => {
      console.log('Connected to Deepgram streaming - STT ready')
      isListening = true
      socket.send(JSON.stringify({
        type: 'stt_ready',
        message: 'Speech-to-text ready'
      }))
    }

    deepgramSocket.onmessage = async (event) => {
      try {
        const result = JSON.parse(event.data)
        
        if (result.channel?.alternatives?.[0]) {
          const transcript = result.channel.alternatives[0].transcript
          const confidence = result.channel.alternatives[0].confidence
          const isFinal = result.is_final
          
          if (transcript.trim()) {
            // Send real-time transcript for live display
            socket.send(JSON.stringify({
              type: 'transcript',
              transcript: transcript,
              confidence: confidence,
              is_final: isFinal,
              timestamp: new Date().toISOString()
            }))

            // Process final transcript with high confidence
            if (isFinal && transcript.trim().length > 2 && confidence > 0.7) {
              console.log('Processing final transcript:', transcript)
              await processUserMessage(transcript)
            }
          }
        }

        // Handle voice activity detection events
        if (result.type === 'SpeechStarted') {
          socket.send(JSON.stringify({
            type: 'speech_started',
            timestamp: new Date().toISOString()
          }))
        } else if (result.type === 'UtteranceEnd') {
          socket.send(JSON.stringify({
            type: 'speech_ended',
            timestamp: new Date().toISOString()
          }))
        }
      } catch (error) {
        console.error('Error processing Deepgram message:', error)
      }
    }

    deepgramSocket.onerror = (error) => {
      console.error('Deepgram streaming error:', error)
      socket.send(JSON.stringify({
        type: 'stt_error',
        message: 'Speech recognition error - retrying...'
      }))
      
      // Attempt to reconnect after a short delay
      setTimeout(() => {
        if (currentSession && !deepgramSocket) {
          initializeDeepgramStreaming()
        }
      }, 2000)
    }

    deepgramSocket.onclose = (event) => {
      console.log('Deepgram connection closed:', event.code, event.reason)
      isListening = false
    }
  }

  async function handleAudioChunk(data: any) {
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN && data.audio) {
      try {
        // Decode base64 audio and send to Deepgram for real-time STT
        const binaryAudio = atob(data.audio)
        const audioBuffer = new Uint8Array(binaryAudio.length)
        for (let i = 0; i < binaryAudio.length; i++) {
          audioBuffer[i] = binaryAudio.charCodeAt(i)
        }
        deepgramSocket.send(audioBuffer)
      } catch (error) {
        console.error('Error processing audio chunk:', error)
      }
    }
  }

  async function processUserMessage(transcript: string) {
    if (isProcessing) {
      console.log('Already processing a message, skipping...')
      return
    }
    
    isProcessing = true
    
    try {
      console.log('Processing user message:', transcript)
      
      // Add user message to conversation history
      conversationHistory.push({
        role: 'user',
        content: transcript,
        timestamp: new Date().toISOString()
      })

      // Send user message to client immediately
      socket.send(JSON.stringify({
        type: 'user_message',
        content: transcript,
        timestamp: new Date().toISOString()
      }))

      // Generate AI response
      const systemPrompt = `You are ${botConfig.name}. ${botConfig.personality || 'You are a helpful AI assistant.'} Keep responses conversational and concise for voice interaction (1-2 sentences).`
      
      console.log('Sending request to Gemini...')
      
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
            topP: 0.9,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const result = await response.json()
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || 
        "I'm having trouble responding right now."

      console.log('AI Response generated:', aiResponse)

      // Add AI response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      })

      // Send AI response to client
      socket.send(JSON.stringify({
        type: 'ai_response',
        content: aiResponse,
        timestamp: new Date().toISOString()
      }))

      // Always generate speech for voice bot
      console.log('Starting TTS generation...')
      await generateSpeech(aiResponse)

    } catch (error) {
      console.error('Error processing user message:', error)
      socket.send(JSON.stringify({
        type: 'processing_error',
        message: 'Failed to process message: ' + error.message
      }))
    } finally {
      isProcessing = false
    }
  }

  async function generateSpeech(text: string) {
    try {
      console.log('Generating speech...')
      
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-asteria-en', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
        }),
      })

      if (!response.ok) {
        throw new Error(`Deepgram TTS error: ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      )

      console.log('TTS audio generated')

      socket.send(JSON.stringify({
        type: 'audio_response',
        audio: base64Audio,
        text: text,
        format: 'mp3',
        timestamp: new Date().toISOString()
      }))

    } catch (error) {
      console.error('TTS Error:', error)
      socket.send(JSON.stringify({
        type: 'tts_error',
        message: 'Failed to generate speech: ' + error.message
      }))
    }
  }

  async function handleStopSession() {
    console.log('Stopping session...')
    isListening = false
    
    if (deepgramSocket) {
      deepgramSocket.close()
      deepgramSocket = null
    }

    if (currentSession) {
      // Save conversation history
      try {
        await supabase
          .from('conversations')
          .insert({
            user_id: currentSession.userId,
            bot_id: currentSession.botId,
            messages: conversationHistory
          })
        console.log('Conversation saved')
      } catch (error) {
        console.error('Failed to save conversation:', error)
      }
    }

    socket.send(JSON.stringify({
      type: 'session_ended'
    }))
  }

  return response
})