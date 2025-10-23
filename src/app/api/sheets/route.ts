import { NextRequest, NextResponse } from 'next/server'
import { saveConversationToSheets, initializeSheet } from '@/lib/sheets'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { conversation, latestResponse } = await request.json()

    if (!conversation || !Array.isArray(conversation)) {
      return NextResponse.json(
        { error: 'Invalid conversation format' },
        { status: 400 }
      )
    }

    // Initialize sheet if needed (this is idempotent)
    await initializeSheet()

    const sessionId = uuidv4()
    const conversationData = {
      timestamp: new Date().toISOString(),
      sessionId,
      messages: conversation,
      summary: latestResponse
    }

    await saveConversationToSheets(conversationData)

    return NextResponse.json({ 
      success: true,
      sessionId 
    })

  } catch (error) {
    console.error('Sheets API error:', error)
    return NextResponse.json(
      { error: 'Failed to save to Google Sheets' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    await initializeSheet()
    return NextResponse.json({ 
      success: true,
      message: 'Sheet initialized successfully'
    })
  } catch (error) {
    console.error('Sheets initialization error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize Google Sheets' },
      { status: 500 }
    )
  }
}