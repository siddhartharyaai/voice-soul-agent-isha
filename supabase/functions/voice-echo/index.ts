import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log('🎤 VOICE ECHO FUNCTION STARTING...')

serve(async (req) => {
  console.log('🎤 REQUEST:', req.method, req.url)
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const upgradeHeader = req.headers.get('upgrade')
  
  if (upgradeHeader?.toLowerCase() === 'websocket') {
    console.log('🎤 WEBSOCKET UPGRADE DETECTED')
    
    try {
      const { socket, response } = Deno.upgradeWebSocket(req)
      console.log('🎤 WEBSOCKET CREATED SUCCESSFULLY')
      
      socket.onopen = () => {
        console.log('🎤 CONNECTION OPENED')
        socket.send(JSON.stringify({
          type: 'ready',
          message: 'Voice echo server connected!'
        }))
      }
      
      socket.onmessage = (event) => {
        console.log('🎤 MESSAGE RECEIVED:', event.data)
        socket.send(JSON.stringify({
          type: 'echo',
          data: event.data,
          timestamp: Date.now()
        }))
      }
      
      socket.onclose = () => console.log('🎤 CONNECTION CLOSED')
      socket.onerror = (err) => console.log('🎤 ERROR:', err)
      
      return response
      
    } catch (error) {
      console.log('🎤 UPGRADE FAILED:', error)
      return new Response('WebSocket upgrade failed', { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  return new Response(JSON.stringify({ 
    status: 'running',
    message: 'Voice echo server ready for WebSocket connections'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})