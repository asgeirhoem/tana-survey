import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { action } = await request.json()
    const apiKey = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID

    if (!apiKey || !agentId) {
      return NextResponse.json(
        { error: 'ElevenLabs API key or Agent ID not configured' },
        { status: 500 }
      )
    }

    if (action === 'start') {
      // For ElevenLabs conversational AI, we don't need to pre-create a conversation
      // The connection will be handled directly by the client SDK
      
      return NextResponse.json({
        success: true,
        agent_id: agentId,
        api_key: apiKey,
        message: 'Ready to connect to ElevenLabs agent'
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('ElevenLabs conversation error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      },
      { status: 500 }
    )
  }
}