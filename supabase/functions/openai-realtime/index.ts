import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { headers } = req
  const upgradeHeader = headers.get("upgrade") || ""

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 })
  }

  const { socket, response } = Deno.upgradeWebSocket(req)
  
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found')
    socket.close(1000, 'Missing OpenAI API key')
    return response
  }

  let openAISocket: WebSocket | null = null
  let sessionStarted = false

  console.log('WebSocket connection opened')

  socket.onopen = () => {
    console.log('Client WebSocket connection established')
  }

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log('Received from client:', data.type)
      
      switch (data.type) {
        case 'start_session':
          await handleStartSession(data)
          break
        case 'send_audio':
          if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
            // Forward audio to OpenAI
            openAISocket.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: data.audio
            }))
          }
          break
        case 'send_text':
          if (openAISocket && openAISocket.readyState === WebSocket.OPEN) {
            // Send text message to OpenAI
            openAISocket.send(JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: [{
                  type: 'input_text',
                  text: data.text
                }]
              }
            }))
            openAISocket.send(JSON.stringify({type: 'response.create'}))
          }
          break
        default:
          console.log('Unknown client message type:', data.type)
      }
    } catch (error) {
      console.error('Error processing client message:', error)
      socket.send(JSON.stringify({
        type: 'error',
        message: error.message
      }))
    }
  }

  socket.onclose = () => {
    console.log('Client WebSocket connection closed')
    if (openAISocket) {
      openAISocket.close()
    }
  }

  async function handleStartSession(data: any) {
    console.log('Starting OpenAI Realtime session...')
    
    try {
      // Connect to OpenAI Realtime API
      openAISocket = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`,
        [],
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        }
      )

      openAISocket.onopen = () => {
        console.log('Connected to OpenAI Realtime API')
        socket.send(JSON.stringify({
          type: 'session_connecting'
        }))
      }

      openAISocket.onmessage = (event) => {
        try {
          const openAIData = JSON.parse(event.data)
          console.log('OpenAI message type:', openAIData.type)
          
          if (openAIData.type === 'session.created') {
            console.log('Session created, sending configuration...')
            
            // Send session configuration
            const sessionConfig = {
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: `You are ${data.botName || 'an AI assistant'}. ${data.personality || 'You are helpful, friendly, and conversational.'} Keep responses natural and conversational for voice interaction.`,
                voice: data.voice || 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                  model: 'whisper-1'
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1000
                },
                temperature: 0.8,
                max_response_output_tokens: 'inf'
              }
            }
            
            openAISocket!.send(JSON.stringify(sessionConfig))
            sessionStarted = true
            
          } else if (openAIData.type === 'session.updated') {
            console.log('Session configured successfully')
            socket.send(JSON.stringify({
              type: 'session_ready'
            }))
            
          } else if (openAIData.type === 'response.audio.delta') {
            // Forward audio response to client
            socket.send(JSON.stringify({
              type: 'audio_delta',
              delta: openAIData.delta
            }))
            
          } else if (openAIData.type === 'response.audio_transcript.delta') {
            // Forward transcript to client
            socket.send(JSON.stringify({
              type: 'transcript_delta',
              delta: openAIData.delta
            }))
            
          } else if (openAIData.type === 'conversation.item.input_audio_transcription.completed') {
            // User speech transcript
            socket.send(JSON.stringify({
              type: 'user_transcript',
              transcript: openAIData.transcript
            }))
            
          } else if (openAIData.type === 'response.created') {
            socket.send(JSON.stringify({
              type: 'response_started'
            }))
            
          } else if (openAIData.type === 'response.done') {
            socket.send(JSON.stringify({
              type: 'response_completed'
            }))
            
          } else if (openAIData.type === 'error') {
            console.error('OpenAI error:', openAIData)
            socket.send(JSON.stringify({
              type: 'error',
              message: openAIData.error?.message || 'OpenAI API error'
            }))
          }
          
        } catch (error) {
          console.error('Error processing OpenAI message:', error)
        }
      }

      openAISocket.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error)
        socket.send(JSON.stringify({
          type: 'error',
          message: 'OpenAI connection error'
        }))
      }

      openAISocket.onclose = (event) => {
        console.log('OpenAI WebSocket closed:', event.code, event.reason)
        socket.send(JSON.stringify({
          type: 'session_ended'
        }))
      }

    } catch (error) {
      console.error('Error connecting to OpenAI:', error)
      socket.send(JSON.stringify({
        type: 'error',
        message: `Failed to connect to OpenAI: ${error.message}`
      }))
    }
  }

  return response
})