import { google } from 'googleapis'
import path from 'path'

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), 'service-account-key.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

export const sheets = google.sheets({ version: 'v4', auth })

export interface ConversationData {
  timestamp: string
  sessionId: string
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

  // Extract key information from the conversation
  const userMessages = data.messages.filter(msg => msg.role === 'user')
  const conversationText = data.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
  
  // Create row data
  const rowData = [
    data.timestamp,
    data.sessionId,
    userMessages.length,
    conversationText,
    data.summary || ''
  ]

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:E',
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
    // Check if the sheet exists and has headers
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:E1'
    })

    // If no data, add headers
    if (!response.data.values || response.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:E1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Timestamp', 'Session ID', 'Message Count', 'Conversation', 'Summary']]
        }
      })
    }
  } catch (error) {
    console.error('Error initializing sheet:', error)
    throw error
  }
}