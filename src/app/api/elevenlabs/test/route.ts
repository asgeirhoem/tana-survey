import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    const agentId = process.env.ELEVENLABS_AGENT_ID

    if (!apiKey || !agentId) {
      return NextResponse.json(
        { error: 'ElevenLabs API key or Agent ID not configured' },
        { status: 500 }
      )
    }

    // Test basic API connection by calling ElevenLabs API directly
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'xi-api-key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    const subscriptionData = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'ElevenLabs connection successful',
      agentId: agentId,
      subscription: {
        tier: subscriptionData.tier,
        character_count: subscriptionData.character_count,
        character_limit: subscriptionData.character_limit
      }
    })

  } catch (error) {
    console.error('ElevenLabs test error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      },
      { status: 500 }
    )
  }
}