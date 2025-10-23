import { google } from 'googleapis'

// Use environment variables for better production deployment
if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
  console.warn('Google Sheets credentials not configured - sheets integration disabled')
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

export const sheets = google.sheets({ version: 'v4', auth })

export interface ConversationData {
  timestamp: string
  sessionId: string
  duration?: number
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp?: string
  }>
  summary?: string
}

export async function saveConversationToSheets(data: ConversationData) {
  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set')
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

  // Extract conversation text
  const conversationText = data.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
  
  // For now, save with empty structured fields and raw conversation
  // TODO: Add conversation processing to extract structured data
  const rowData = [
    data.timestamp,                    // Timestamp
    data.sessionId,                   // Session ID  
    data.duration || '',              // Duration (seconds)
    '',                              // Role (to be extracted)
    '',                              // Team Size (to be extracted)
    '',                              // Location Setup (to be extracted)
    '',                              // Company Stage (to be extracted)
    '',                              // Industry Sector (to be extracted)
    '',                              // Project Management Tools (to be extracted)
    '',                              // Documentation Tools (to be extracted)
    '',                              // Communication Tools (to be extracted)
    '',                              // AI Usage (to be extracted)
    '',                              // Meeting Practices (to be extracted)
    '',                              // Main Pain Points (to be extracted)
    '',                              // Tool Satisfaction (to be extracted)
    '',                              // Looking to Change (to be extracted)
    conversationText                 // Raw Conversation
  ]

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:Q',
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData]
      }
    })
  } catch (error) {
    console.error('Error saving to Google Sheets:', error)
    throw error
  }
}

export async function initializeSheet() {
  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set')
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

  try {
    // Always update headers to ensure they match current structure
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:Q1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'Timestamp', 'Session ID', 'Duration (seconds)',
          'Role', 'Team Size', 'Location Setup', 'Company Stage', 'Industry Sector',
          'Project Management Tools', 'Documentation Tools', 'Communication Tools',
          'AI Usage', 'Meeting Practices', 'Main Pain Points', 'Tool Satisfaction',
          'Looking to Change', 'Raw Conversation'
        ]]
      }
    })
  } catch (error) {
    console.error('Error initializing sheet:', error)
    throw error
  }
}