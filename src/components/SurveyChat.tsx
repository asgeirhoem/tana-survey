'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const INITIAL_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: "Hi! I'd love to learn about your startup and how your team works. Let's start with something simple - what's your company about and what problem are you solving?",
  timestamp: new Date()
}

export default function SurveyChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [isSessionEnding, setIsSessionEnding] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chatInputRef = useRef<any>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Session timer effect
  useEffect(() => {
    if (sessionStartTime && !isSessionEnding) {
      sessionTimerRef.current = setInterval(() => {
        const now = new Date()
        const duration = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000)
        setSessionDuration(duration)
        
        // Wind down conversation at 60 seconds
        if (duration >= 60) {
          setIsSessionEnding(true)
          if (sessionTimerRef.current) {
            clearInterval(sessionTimerRef.current)
          }
        }
      }, 1000)

      return () => {
        if (sessionTimerRef.current) {
          clearInterval(sessionTimerRef.current)
        }
      }
    }
  }, [sessionStartTime, isSessionEnding])

  // Start session timer on first keystroke
  const startSessionTimer = useCallback(() => {
    if (!sessionStartTime) {
      setSessionStartTime(new Date())
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          sessionDuration,
          isSessionEnding
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
              // Re-focus input after AI response completes
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
  }, [messages])

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Subtle timer in bottom right */}
      {sessionStartTime && (
        <div className="fixed bottom-4 right-4 text-muted pointer-events-none" style={{ fontSize: '10px' }}>
          {sessionDuration}s
        </div>
      )}
      
      {isSessionEnding && (
        <div className="px-4 sm:px-6 py-2 bg-secondary border-b border-subtle">
          <p className="text-secondary text-sm text-center">
            Survey completing - thank you for your time! 🙏
          </p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-16 pb-8 max-w-2xl mx-auto w-full">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
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
      <div className="px-4 sm:px-6 pb-4 max-w-2xl mx-auto w-full">
        <ChatInput 
          ref={chatInputRef}
          onSendMessage={handleSendMessage} 
          onFirstKeystroke={startSessionTimer}
          autoFocus={true}
          disabled={isLoading || isSessionEnding} 
        />
      </div>
    </div>
  )
}