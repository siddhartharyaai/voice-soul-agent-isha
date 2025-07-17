import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { headers } = req
  const upgradeHeader = headers.get("upgrade") || ""

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)
  
  // Get environment variables
  const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
  
  if (!DEEPGRAM_API_KEY || !GEMINI_API_KEY) {
    socket.close(1000, 'Missing API keys')
    return response
  }

  let isListening = false
  let currentSession = null
  let conversationHistory: any[] = []
  let botConfig = null
  let deepgramSocket: WebSocket | null = null

  // Create Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )

  socket.onopen = () => {
    console.log('WebSocket connection opened')
  }

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'start_session':
          await handleStartSession(data)
          break
        case 'audio_chunk':
          await handleAudioChunk(data)
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
        type: 'error',
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

  async function handleStartSession(data: any) {
    const { botId, userId } = data
    
    try {
      // Get bot configuration
      const { data: bot, error: botError } = await supabase
        .from('bots')
        .select('*')
        .eq('id', botId)
        .eq('user_id', userId)
        .single()

      if (botError || !bot) {
        throw new Error('Bot not found or access denied')
      }

      botConfig = bot
      currentSession = {
        sessionId: crypto.randomUUID(),
        botId,
        userId,
        startTime: new Date().toISOString()
      }

      // Initialize Deepgram streaming STT
      initializeDeepgramStreaming()

      socket.send(JSON.stringify({
        type: 'session_started',
        sessionId: currentSession.sessionId,
        botName: bot.name
      }))

    } catch (error) {
      socket.send(JSON.stringify({
        type: 'error',
        message: `Failed to start session: ${error.message}`
      }))
    }
  }

  function initializeDeepgramStreaming() {
    const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&endpointing=300&utterance_end_ms=1000`
    
    deepgramSocket = new WebSocket(deepgramUrl, [
      'token',
      DEEPGRAM_API_KEY
    ])

    deepgramSocket.onopen = () => {
      console.log('Connected to Deepgram streaming')
      isListening = true
    }

    deepgramSocket.onmessage = async (event) => {
      const result = JSON.parse(event.data)
      
      if (result.channel?.alternatives?.[0]) {
        const transcript = result.channel.alternatives[0].transcript
        const isFinal = result.is_final
        
        if (transcript.trim()) {
          // Send partial transcript for real-time display
          socket.send(JSON.stringify({
            type: 'transcript',
            text: transcript,
            isFinal: isFinal
          }))

          // Process final transcript
          if (isFinal && transcript.trim().length > 3) {
            await processUserMessage(transcript)
          }
        }
      }
    }

    deepgramSocket.onerror = (error) => {
      console.error('Deepgram error:', error)
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Speech recognition error'
      }))
    }
  }

  async function handleAudioChunk(data: any) {
    if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN && data.audio) {
      // Send audio to Deepgram for real-time transcription
      deepgramSocket.send(data.audio)
    }
  }

  async function processUserMessage(transcript: string) {
    try {
      // Add user message to conversation history
      conversationHistory.push({
        role: 'user',
        content: transcript
      })

      // Send user message to client
      socket.send(JSON.stringify({
        type: 'user_message',
        content: transcript
      }))

      // Get AI response
      const systemPrompt = `You are ${botConfig.name}. ${botConfig.personality || 'You are a helpful AI assistant.'} Keep responses conversational and concise for voice interaction.`
      
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10) // Last 10 messages for context
      ]

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${botConfig.model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: messages.slice(1).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          })),
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 150, // Shorter responses for voice
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${await response.text()}`)
      }

      const result = await response.json()
      const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || 'I apologize, but I could not generate a response.'

      // Add AI response to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: aiResponse
      })

      // Send AI response to client
      socket.send(JSON.stringify({
        type: 'ai_response',
        content: aiResponse
      }))

      // Generate speech if auto-speak is enabled
      if (botConfig.auto_speak) {
        await generateSpeech(aiResponse)
      }

    } catch (error) {
      console.error('Error processing user message:', error)
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }))
    }
  }

  async function generateSpeech(text: string) {
    try {
      const response = await fetch('https://api.deepgram.com/v1/speak', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model: botConfig.voice || 'aura-2-thalia-en',
        }),
      })

      if (!response.ok) {
        throw new Error(`Deepgram TTS API error: ${await response.text()}`)
      }

      // Get audio as array buffer and convert to base64
      const arrayBuffer = await response.arrayBuffer()
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      )

      // Send audio to client
      socket.send(JSON.stringify({
        type: 'audio_response',
        audio: base64Audio
      }))

    } catch (error) {
      console.error('TTS Error:', error)
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to generate speech'
      }))
    }
  }

  async function handleStopSession() {
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