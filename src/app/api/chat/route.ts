import { NextRequest } from 'next/server'
import { anthropic, SURVEY_SYSTEM_PROMPT } from '@/lib/anthropic'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { messages, sessionDuration = 0, isSessionEnding = false } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create dynamic system prompt with session context
    let contextualPrompt = SURVEY_SYSTEM_PROMPT
    if (sessionDuration > 0) {
      contextualPrompt += `\n\nSESSION CONTEXT: This conversation has been going for ${sessionDuration} seconds.`
      
      if (sessionDuration >= 50 && sessionDuration < 60) {
        contextualPrompt += ` Start wrapping up the survey naturally - ask one final key question and prepare to conclude.`
      } else if (isSessionEnding) {
        contextualPrompt += ` This is the final response. Thank them for their time and provide a brief summary of the key insights you gathered about their startup.`
      }
    }

    const stream = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Faster model
      max_tokens: 1024,
      system: contextualPrompt,
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      stream: true
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta') {
              const text = chunk.delta.text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process chat message' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}