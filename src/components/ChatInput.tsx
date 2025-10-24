'use client'

import { useState, useRef, useEffect, forwardRef, useCallback } from 'react'
import React from 'react'

interface SuggestionGroup {
  category: string
  suggestions: string[]
}

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onFirstKeystroke?: () => void
  autoFocus?: boolean
  disabled?: boolean
  isSessionEnding?: boolean
  isLoading?: boolean
  lastAssistantMessage?: string
  bufferedAssistantMessage?: string
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(function ChatInput({ onSendMessage, onFirstKeystroke, autoFocus = false, disabled = false, isSessionEnding = false, isLoading = false, lastAssistantMessage = '', bufferedAssistantMessage = '' }, ref) {
  const [message, setMessage] = useState('')
  const [hasStartedTyping, setHasStartedTyping] = useState(false)
  const [clickedSuggestions, setClickedSuggestions] = useState<Set<string>>(new Set())
  // Static suggestions for the initial question - using Y Combinator categories
  const INITIAL_SUGGESTIONS: SuggestionGroup[] = [
    {
      category: "Startup category",
      suggestions: ["B2B", "Consumer", "Fintech", "Healthcare", "Developer tools", "AI", "EdTech", "Climate", "Biotech", "Hardware"]
    }
  ]

  const [suggestionGroups, setSuggestionGroups] = useState<SuggestionGroup[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Check if text is actually a question that needs suggestions
  const isQuestion = (text: string) => {
    const lowerText = text.toLowerCase().trim()
    
    // Skip obvious non-questions (but allow if they contain question indicators)
    const hasQuestionIndicators = lowerText.includes('?') || 
           lowerText.includes('what') || 
           lowerText.includes('how') || 
           lowerText.includes('which') || 
           lowerText.includes('where') || 
           lowerText.includes('when') || 
           lowerText.includes('why') ||
           lowerText.includes('do you') ||
           lowerText.includes('are you') ||
           lowerText.includes('can you')
    
    if (!hasQuestionIndicators && (
        lowerText.includes('perfect, thanks') || 
        lowerText.includes('thank you') ||
        lowerText.includes('thanks for') ||
        lowerText === 'got it' ||
        lowerText.startsWith('okay,') ||
        lowerText.startsWith('understood') ||
        lowerText.startsWith('interesting'))) {
      return false
    }
    
    // Return true if it has question indicators
    return hasQuestionIndicators ||
           lowerText.includes('would you')
  }

  // Fetch AI-generated suggestions
  const fetchSuggestions = async (question: string) => {
    console.log('🔍 Checking if question needs suggestions:', question.slice(0, 100) + (question.length > 100 ? '...' : ''))
    
    if (!question.trim()) {
      console.log('❌ Empty question, clearing suggestions')
      setSuggestionGroups([])
      return
    }
    
    if (!isQuestion(question)) {
      console.log('⏭️ Not a question, skipping suggestions')
      setSuggestionGroups([])
      return
    }
    
    console.log('📤 Valid question, fetching suggestions')
    setLoadingSuggestions(true)
    try {
      console.log('📤 Sending suggestions API request')
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Received suggestions:', data.groups?.length || 0, 'groups')
        console.log('📝 Suggestion groups:', data.groups)
        setSuggestionGroups(data.groups || [])
      } else {
        console.log('❌ Suggestions API error:', response.status, response.statusText)
        setSuggestionGroups([])
      }
    } catch (error) {
      console.error('❌ Failed to fetch suggestions:', error)
      setSuggestionGroups([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Track which messages we've already processed
  const processedMessagesRef = useRef(new Set<string>())
  const lastProcessedRef = useRef('')
  
  // Clear processed messages on hot reload to prevent stale state
  useEffect(() => {
    return () => {
      processedMessagesRef.current.clear()
      lastProcessedRef.current = ''
    }
  }, [])
  
  // Check if this is the initial question about company/problem
  const isInitialQuestion = (message: string) => {
    const lowerMsg = message.toLowerCase()
    return lowerMsg.includes("what's your company about") && lowerMsg.includes("what problem are you solving")
  }

  // Clear suggestions when loading starts, fetch suggestions only once per complete message
  useEffect(() => {
    if (isLoading) {
      console.log('⏳ Loading active, clearing suggestions')
      setSuggestionGroups([])
      return
    }

    // Use buffered message if available (complete), otherwise fall back to visual message
    const messageToUse = bufferedAssistantMessage || lastAssistantMessage
    if (!messageToUse) {
      console.log('❌ No message to process')
      return
    }

    const messageHash = messageToUse.trim()
    
    // Only proceed if this is truly a different message
    if (messageHash === lastProcessedRef.current) {
      return
    }
    
    console.log('🔑 Message hash check:', messageHash.slice(0, 50) + '...', 'Already processed:', processedMessagesRef.current.has(messageHash))
    
    if (processedMessagesRef.current.has(messageHash)) {
      console.log('⏭️ Message already processed, skipping')
      return
    }

    console.log('🆕 New message, marking as processed')
    processedMessagesRef.current.add(messageHash)
    lastProcessedRef.current = messageHash
    
    // Use static suggestions for the initial question
    if (isInitialQuestion(messageToUse)) {
      console.log('⚡ Using static suggestions for initial question')
      setSuggestionGroups(INITIAL_SUGGESTIONS)
    } else {
      fetchSuggestions(messageToUse)
    }
  }, [bufferedAssistantMessage, lastAssistantMessage, isLoading])

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(prev => prev ? `${prev}, ${suggestion}` : suggestion)
    setClickedSuggestions(prev => new Set(prev).add(suggestion))
    const textarea = (typeof ref === 'object' && ref?.current) || textareaRef.current
    if (textarea) {
      textarea.focus()
    }
  }

  // Update clicked suggestions based on current message content
  React.useEffect(() => {
    const allSuggestions = suggestionGroups.flatMap(group => group.suggestions)
    const currentSuggestions = allSuggestions.filter(suggestion => 
      message.split(',').map(s => s.trim()).includes(suggestion)
    )
    setClickedSuggestions(new Set(currentSuggestions))
  }, [message, suggestionGroups])

  // Track the last question we reset suggestions for
  const [lastResetMessage, setLastResetMessage] = useState('')
  
  // Reset clicked suggestions only when we get a truly new complete question
  React.useEffect(() => {
    if (!lastAssistantMessage) return
    
    const trimmedMessage = lastAssistantMessage.trim()
    const seemsComplete = /[.!?]$/.test(trimmedMessage) || trimmedMessage.includes('?')
    
    // Only reset if this is a new question we haven't reset for before
    if (seemsComplete && trimmedMessage !== lastResetMessage) {
      setClickedSuggestions(new Set())
      setLastResetMessage(trimmedMessage)
    }
  }, [lastAssistantMessage, lastResetMessage])

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Focus method that can be called from parent
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      const focusInput = () => {
        textareaRef.current?.focus()
      }
      // Small delay to ensure DOM is ready
      setTimeout(focusInput, 100)
    }
  }, [disabled])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSendMessage(message.trim())
      setMessage('')
      // Re-focus after sending message
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setMessage(newValue)
    
    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    
    // Start timer on first character typed
    if (!hasStartedTyping && newValue.length > 0) {
      setHasStartedTyping(true)
      onFirstKeystroke?.()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="w-full">
      {/* Reserved space for suggestions - always present to prevent layout shift */}
      <div className="mb-3" style={{ minHeight: '72px' }}>
        {suggestionGroups.length > 0 && !isSessionEnding && (
          <div className="animate-in fade-in duration-100">
            <div className="flex flex-wrap gap-2 mb-2 items-end justify-start">
              {(() => {
                // Flatten all suggestions and limit to 10
                const allSuggestions = suggestionGroups.flatMap(group => group.suggestions).slice(0, 10)
                let currentGroupIndex = 0
                let currentGroup = suggestionGroups[0]
                let suggestionIndexInGroup = 0
                
                return allSuggestions.map((suggestion, index) => {
                  // Find which group this suggestion belongs to
                  while (currentGroup && suggestionIndexInGroup >= currentGroup.suggestions.length) {
                    currentGroupIndex++
                    currentGroup = suggestionGroups[currentGroupIndex]
                    suggestionIndexInGroup = 0
                  }
                  
                  const isClicked = clickedSuggestions.has(suggestion)
                  const isNewGroup = suggestionIndexInGroup === 0 && currentGroupIndex > 0
                  
                  suggestionIndexInGroup++
                  
                  return (
                    <React.Fragment key={index}>
                      {isNewGroup && (
                        <div className="w-px h-6 bg-light self-center mx-1"></div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        disabled={disabled}
                        className={`px-2 py-1 text-sm rounded border bg-transparent transition-all duration-300 ${
                          isClicked 
                            ? 'opacity-30 text-muted border-transparent' 
                            : 'text-muted hover:text-primary border-light hover:border-primary'
                        }`}
                      >
                        {suggestion}
                      </button>
                    </React.Fragment>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className={`w-full transition-opacity duration-1000 ${
        isSessionEnding ? 'opacity-20' : 'opacity-100'
      }`}>
        <div className="relative">
          <textarea
            ref={ref || textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isSessionEnding ? "Submitted!" : "Type your response..."}
            disabled={disabled || isSessionEnding}
            autoFocus
            className="w-full px-4 py-4 pr-12 text-base bg-secondary text-primary rounded-lg outline-none resize-none placeholder-muted focus:!shadow-[0_0_0_2px_var(--border-primary)] transition-all duration-200 sm:px-3 sm:py-3 sm:pr-10 border border-subtle"
            style={{ 
              borderColor: 'var(--border-subtle)'
            } as React.CSSProperties}
            rows={1}
          />
          {/* Submit button hidden on mobile, visible on desktop */}
          <button
            type="submit"
            disabled={!message.trim() || disabled || isSessionEnding}
            className="hidden sm:flex absolute bottom-5 right-3 items-center justify-center w-6 h-6 text-muted hover:text-primary transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none" 
              className="rotate-0"
            >
              <path 
                d="M8 3L13 8L8 13M13 8H3" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
})

export default ChatInput