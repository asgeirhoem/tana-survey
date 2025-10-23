'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import TanaLogo from './TanaLogo'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const INITIAL_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: "Hi! The Tana design team would like to learn about your startup and how your team works.\n\nWhat's your company about and what problem are you solving?",
  timestamp: new Date()
}

export default function SurveyChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [isSessionEnding, setIsSessionEnding] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<any>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Save data on page unload
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Only save if we have actual conversation data
      if (messages.length > 1 && sessionStartTime) {
        const sessionDuration = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000)
        
        // Use sendBeacon for reliable data sending during page unload
        const data = {
          conversation: messages,
          latestResponse: messages[messages.length - 1]?.content || '',
          sessionDuration,
          isAbruptExit: true
        }
        
        navigator.sendBeacon('/api/sheets', JSON.stringify(data))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [messages, sessionStartTime])


  // Start session on first keystroke
  const startSession = useCallback(() => {
    if (!sessionStartTime) {
      setSessionStartTime(new Date())
    }
  }, [sessionStartTime])

  // Check if we should tell AI to conclude based on data completeness
  const shouldConcludeConversation = useCallback((conversation: Message[]) => {
    // Count how many of our target data points we likely have
    const userMessages = conversation.filter(m => m.role === 'user').map(m => m.content.toLowerCase())
    const allUserText = userMessages.join(' ')
    
    // Check for key data points mentioned
    let dataPoints = 0
    
    // Role/team size (often in first response)
    if (allUserText.includes('ceo') || allUserText.includes('cto') || allUserText.includes('founder') || 
        allUserText.includes('engineer') || allUserText.includes('people') || allUserText.includes('team')) dataPoints++
    
    // Location setup
    if (allUserText.includes('remote') || allUserText.includes('office') || allUserText.includes('hybrid')) dataPoints++
    
    // Tools mentioned
    if (allUserText.includes('slack') || allUserText.includes('notion') || allUserText.includes('jira') || 
        allUserText.includes('linear') || allUserText.includes('trello') || allUserText.includes('asana')) dataPoints++
    
    // AI usage
    if (allUserText.includes('chatgpt') || allUserText.includes('claude') || allUserText.includes('copilot') || 
        allUserText.includes('ai') || allUserText.includes('none')) dataPoints++
    
    // Industry/stage
    if (allUserText.includes('seed') || allUserText.includes('series') || allUserText.includes('bootstrap') || 
        allUserText.includes('startup') || allUserText.includes('saas') || allUserText.includes('fintech')) dataPoints++
    
    // End if we have good coverage (4+ data points) and at least 3 exchanges
    return dataPoints >= 4 && userMessages.length >= 3
  }, [])

  // Check if conversation should end based on AI response
  const checkForConversationEnd = useCallback(async (latestResponse: string, conversation: Message[]) => {
    // Only end on the specific conclusion phrase from our prompt
    if (latestResponse.toLowerCase().includes('perfect, thanks!')) {
      
      // Mark session as ending
      setIsSessionEnding(true)
      
      // Submit conversation to Google Sheets
      const sessionDuration = sessionStartTime ? 
        Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000) : 0
      
      try {
        await fetch('/api/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation,
            latestResponse,
            sessionDuration
          })
        })
      } catch (error) {
        console.error('Failed to save conversation:', error)
      }
    }
  }, [sessionStartTime])

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Create placeholder for streaming response
    const assistantMessageId = (Date.now() + 1).toString()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, assistantMessage])

    try {
      const updatedConversation = [...messages, userMessage]
      const shouldConclude = shouldConcludeConversation(updatedConversation)
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedConversation.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          shouldConclude
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setIsLoading(false)
              
              // Check if conversation should end
              const finalConversation = [...messages, userMessage, { 
                ...assistantMessage, 
                content: accumulatedContent 
              }]
              await checkForConversationEnd(accumulatedContent, finalConversation)
              
              // Auto-save after each exchange (in case of abrupt exit)
              if (finalConversation.length > 3 && sessionStartTime) {
                try {
                  await fetch('/api/sheets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      conversation: finalConversation,
                      latestResponse: accumulatedContent,
                      sessionDuration: Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000),
                      isAutoSave: true
                    })
                  })
                } catch (error) {
                  console.error('Auto-save failed:', error)
                }
              }
              
              // Re-focus input after AI response completes (if not ending)
              setTimeout(() => {
                const textarea = document.querySelector('textarea')
                if (textarea && !isSessionEnding) {
                  textarea.focus()
                }
              }, 100)
              return
            }
            
            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                accumulatedContent += parsed.text
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                )
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: "I'm sorry, there was an error processing your message. Please try again." }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [messages, checkForConversationEnd, isSessionEnding])

  return (
    <div className="min-h-screen flex flex-col relative transition-colors duration-1000" style={{
      backgroundColor: isSessionEnding ? 'var(--colorGreen50)' : 'var(--bg-primary)'
    }}>
      
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-2 sm:pb-8 max-w-2xl mx-auto w-full">
        <div className="mb-6 sm:mb-8">
          <TanaLogo className="h-10 sm:h-12 w-auto" />
        </div>
        {messages.map((message, index) => {
          const isLastAssistantMessage = isSessionEnding && 
            message.role === 'assistant' && 
            index === messages.length - 1
          const shouldFadeOut = isSessionEnding && !isLastAssistantMessage
          
          return (
            <div 
              key={message.id}
              className={`transition-opacity duration-1000 ${
                shouldFadeOut ? 'opacity-20' : 'opacity-100'
              }`}
            >
              <ChatMessage message={message} isSessionEnding={isSessionEnding} />
            </div>
          )
        })}
        {isLoading && (
          <div className="mb-6 text-left">
            <div className="inline-block">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)', animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-muted)', animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Fixed input container for mobile */}
      <div className="sticky bottom-0 px-4 sm:px-6 pb-4 sm:pb-12 pt-2 sm:pt-0 max-w-2xl mx-auto w-full" style={{
        backgroundColor: isSessionEnding ? 'var(--colorGreen50)' : 'var(--bg-primary)'
      }}>
        <ChatInput 
          ref={chatInputRef}
          onSendMessage={handleSendMessage} 
          onFirstKeystroke={startSession}
          autoFocus={true}
          disabled={isLoading || isSessionEnding}
          isSessionEnding={isSessionEnding}
          lastAssistantMessage={
            messages.length > 0 ? 
            messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '' : 
            ''
          }
        />
      </div>
    </div>
  )
}