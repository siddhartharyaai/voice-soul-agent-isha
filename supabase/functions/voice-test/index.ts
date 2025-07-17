import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

console.log('🔥 VOICE FUNCTION STARTING UP...')

serve(async (req) => {
  console.log('🔥 REQUEST RECEIVED:', req.method, req.url)
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    console.log('🔥 HANDLING CORS PREFLIGHT')
    return new Response('ok', { headers: corsHeaders })
  }

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = req.headers.get('upgrade')
  console.log('🔥 UPGRADE HEADER:', upgradeHeader)
  
  if (upgradeHeader?.toLowerCase() === 'websocket') {
    console.log('🔥 WEBSOCKET UPGRADE REQUEST DETECTED')
    
    try {
      const { socket, response } = Deno.upgradeWebSocket(req)
      console.log('🔥 WEBSOCKET UPGRADE SUCCESSFUL')
      
      socket.onopen = () => {
        console.log('🔥 WEBSOCKET CONNECTION OPENED')
        socket.send(JSON.stringify({
          type: 'connection_ready',
          message: 'Voice system connected successfully!'
        }))
      }
      
      socket.onmessage = (event) => {
        console.log('🔥 RECEIVED MESSAGE:', event.data)
        try {
          const data = JSON.parse(event.data)
          socket.send(JSON.stringify({
            type: 'echo',
            original: data,
            timestamp: new Date().toISOString()
          }))
        } catch (e) {
          console.log('🔥 PARSE ERROR:', e)
        }
      }
      
      socket.onclose = () => {
        console.log('🔥 WEBSOCKET CONNECTION CLOSED')
      }
      
      socket.onerror = (error) => {
        console.log('🔥 WEBSOCKET ERROR:', error)
      }
      
      return response
      
    } catch (error) {
      console.log('🔥 WEBSOCKET UPGRADE FAILED:', error)
      return new Response('WebSocket upgrade failed: ' + error.message, { 
        status: 500,
        headers: corsHeaders 
      })
    }
  }
  
  // Regular HTTP request
  console.log('🔥 REGULAR HTTP REQUEST')
  return new Response(JSON.stringify({ 
    status: 'working',
    timestamp: new Date().toISOString(),
    message: 'Voice function is running! Use WebSocket upgrade for voice features.'
  }), {
    headers: { 
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
})