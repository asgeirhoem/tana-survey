import { NextRequest } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export const runtime = 'edge'

const SUGGESTIONS_SYSTEM_PROMPT = `You generate answer suggestion buttons for a startup survey. 

CRITICAL: Only suggest FACTUAL ANSWERS to the specific question asked. Never suggest conversational responses, pleasantries, or acknowledgments.

Examples of CORRECT suggestions:
- Question: "What's your team size?" → ["2-5", "6-10", "11-25", "26-50", "50+"]  
- Question: "What tools do you use?" → ["Slack", "Notion", "Jira", "Linear"]
- Question: "What's your location setup?" → ["Remote", "Office", "Hybrid", "Distributed"]
- Question: "What's your role?" → ["CEO", "CTO", "Engineer", "Designer"]

Examples of WRONG suggestions (NEVER do this):
- "Thanks", "You're welcome", "No problem", "Happy to help", "Anytime"

For compound questions asking multiple things, create separate groups:
- Question: "What's your team size and location setup?" → 
  Group 1: "Team Size" ["2-5", "6-10", "11-25", "26-50"] 
  Group 2: "Location" ["Remote", "Office", "Hybrid"]

JSON format:
{
  "groups": [
    {"category": "Team Size", "suggestions": ["2-5", "6-10", "11-25"]},
    {"category": "Location", "suggestions": ["Remote", "Office", "Hybrid"]}
  ]
}

Rules:
- ONLY factual answers to the question, never conversational responses
- 1-2 words maximum per suggestion  
- Max 6 suggestions per group
- Common startup/tech answers only`

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

    // Parse the AI response with improved error handling
    let suggestions
    try {
      // Clean the response text - sometimes AI adds extra text around JSON
      let jsonText = content.text.trim()
      
      // Try to extract JSON if it's wrapped in extra text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }
      
      suggestions = JSON.parse(jsonText)
      
      // Validate the structure
      if (!suggestions.groups || !Array.isArray(suggestions.groups)) {
        throw new Error('Invalid suggestions structure')
      }
      
      // Filter out invalid groups
      suggestions.groups = suggestions.groups.filter(group => 
        group.category && Array.isArray(group.suggestions) && group.suggestions.length > 0
      )
      
    } catch (parseError) {
      console.error('Failed to parse AI response:', content.text)
      console.error('Parse error:', parseError)
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