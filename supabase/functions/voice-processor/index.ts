import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

console.log('Voice Processor Function starting...')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data, botConfig } = await req.json()
    
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    
    if (!DEEPGRAM_API_KEY || !GEMINI_API_KEY) {
      throw new Error('Missing required API keys')
    }

    console.log('Processing:', type)

    switch (type) {
      case 'speech_to_text':
        return await handleSpeechToText(data.audio, DEEPGRAM_API_KEY)
      
      case 'generate_response':
        return await handleGenerateResponse(data.transcript, botConfig, GEMINI_API_KEY)
      
      case 'text_to_speech':
        return await handleTextToSpeech(data.text, botConfig.voice, DEEPGRAM_API_KEY)
      
      default:
        throw new Error('Unknown processing type')
    }

  } catch (error) {
    console.error('Processing error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function handleSpeechToText(audioBase64: string, apiKey: string) {
  console.log('Processing speech to text...')
  
  try {
    // Decode base64 audio
    const binaryAudio = atob(audioBase64)
    const audioBuffer = new Uint8Array(binaryAudio.length)
    for (let i = 0; i < binaryAudio.length; i++) {
      audioBuffer[i] = binaryAudio.charCodeAt(i)
    }

    // Prepare form data for Deepgram
    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: 'audio/webm' })
    formData.append('file', blob, 'audio.webm')
    formData.append('model', 'nova-2')
    formData.append('smart_format', 'true')

    const response = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Deepgram STT error: ${response.status}`)
    }

    const result = await response.json()
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    
    console.log('STT result:', transcript)

    return new Response(JSON.stringify({
      success: true,
      transcript: transcript,
      confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('STT error:', error)
    throw error
  }
}

async function handleGenerateResponse(transcript: string, botConfig: any, apiKey: string) {
  console.log('Generating AI response for:', transcript)
  
  try {
    const systemPrompt = `You are ${botConfig.name}. ${botConfig.personality || 'You are a helpful AI assistant.'} 

Keep your responses:
- Conversational and natural for voice interaction
- Concise (1-2 sentences maximum)
- Engaging and appropriate for real-time chat
- Avoid markdown, special characters, or formatting

User: ${transcript}

Respond naturally:`

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 150,
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

    console.log('AI response generated:', aiResponse)

    return new Response(JSON.stringify({
      success: true,
      response: aiResponse.trim()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('AI generation error:', error)
    throw error
  }
}

async function handleTextToSpeech(text: string, voice: string, apiKey: string) {
  console.log('Generating speech for:', text)
  
  try {
    // Map bot voice to Deepgram voice
    const voiceMap: { [key: string]: string } = {
      'alloy': 'aura-asteria-en',
      'echo': 'aura-luna-en', 
      'fable': 'aura-stella-en',
      'onyx': 'aura-zeus-en',
      'nova': 'aura-asteria-en',
      'shimmer': 'aura-hera-en'
    }
    
    const deepgramVoice = voiceMap[voice] || 'aura-asteria-en'

    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${deepgramVoice}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
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

    return new Response(JSON.stringify({
      success: true,
      audio: base64Audio,
      format: 'mp3'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('TTS error:', error)
    throw error
  }
}