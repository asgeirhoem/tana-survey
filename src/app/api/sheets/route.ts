import { NextRequest, NextResponse } from 'next/server'
import { saveConversationToSheets, initializeSheet } from '@/lib/sheets'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 
        !process.env.GOOGLE_SHEETS_PRIVATE_KEY || 
        !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      console.error('Google Sheets credentials not fully configured')
      return NextResponse.json(
        { error: 'Google Sheets not configured' },
        { status: 500 }
      )
    }

    const { conversation, latestResponse, sessionDuration, isAbruptExit, isAutoSave } = await request.json()

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
      duration: sessionDuration,
      messages: conversation,
      summary: latestResponse + (isAbruptExit ? ' [ABRUPT EXIT]' : '') + (isAutoSave ? ' [AUTO-SAVED]' : '')
    }

    await saveConversationToSheets(conversationData)

    return NextResponse.json({ 
      success: true,
      sessionId 
    })

  } catch (error) {
    console.error('Sheets API error:', error)
    
    // More specific error messages
    if (error instanceof Error) {
      if (error.message.includes('GOOGLE_SHEETS_SPREADSHEET_ID')) {
        return NextResponse.json(
          { error: 'Google Sheets configuration missing' },
          { status: 500 }
        )
      }
      if (error.message.includes('service-account-key.json')) {
        return NextResponse.json(
          { error: 'Google Service Account credentials missing' },
          { status: 500 }
        )
      }
    }
    
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