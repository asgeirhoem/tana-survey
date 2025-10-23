import { NextRequest } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export const runtime = 'edge'

const SUGGESTIONS_SYSTEM_PROMPT = `You are helping generate quick suggestion buttons for a startup/tech company survey. 

Given a question, provide 1-2 word suggestions that startups and tech companies would commonly answer. Focus on brevity and common responses in the startup ecosystem.

If the question asks multiple things, group the suggestions by topic.

Return your response as a JSON object with this structure:
{
  "groups": [
    {
      "category": "Location", 
      "suggestions": ["Remote", "SF", "NYC", "London", "Berlin"]
    },
    {
      "category": "Team Size",
      "suggestions": ["2-5", "6-10", "11-25", "26-50", "50+"]
    }
  ]
}

Guidelines:
- Keep suggestions to 1-2 words max
- Maximum 6 suggestions per group
- Focus on common startup/tech responses
- If only one topic is asked, create one group
- Use clear category names
- Prioritize most common answers first`

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { question } = await request.json()

    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200, // Reduced from 500 - we only need short JSON responses
      system: SUGGESTIONS_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Question: "${question}"\n\nGenerate appropriate suggestion buttons for this question.`
      }]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response format')
    }

    // Parse the AI response
    let suggestions
    try {
      suggestions = JSON.parse(content.text)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content.text)
      // Fallback to empty groups
      suggestions = { groups: [] }
    }

    return new Response(
      JSON.stringify(suggestions),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Suggestions API error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate suggestions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}