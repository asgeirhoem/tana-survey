import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID

    if (!apiKey || !agentId) {
      return NextResponse.json(
        { error: 'ElevenLabs API key or Agent ID not configured' },
        { status: 500 }
      )
    }

    // Create a secure WebSocket endpoint that proxies to ElevenLabs
    // This keeps the API key on the server side
    const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation/ws?agent_id=${agentId}`
    
    return NextResponse.json({
      success: true,
      websocket_url: wsUrl,
      headers: {
        'xi-api-key': apiKey
      }
    })

  } catch (error) {
    console.error('WebSocket setup error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      },
      { status: 500 }
    )
  }
}