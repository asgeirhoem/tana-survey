'use client'

import { useState, useRef, useEffect, forwardRef } from 'react'
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
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(function ChatInput({ onSendMessage, onFirstKeystroke, autoFocus = false, disabled = false, isSessionEnding = false, isLoading = false, lastAssistantMessage = '' }, ref) {
  const [message, setMessage] = useState('')
  const [hasStartedTyping, setHasStartedTyping] = useState(false)
  const [clickedSuggestions, setClickedSuggestions] = useState<Set<string>>(new Set())
  const [suggestionGroups, setSuggestionGroups] = useState<SuggestionGroup[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch AI-generated suggestions
  const fetchSuggestions = async (question: string) => {
    if (!question.trim()) {
      setSuggestionGroups([])
      return
    }

    setLoadingSuggestions(true)
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })
      
      if (response.ok) {
        const data = await response.json()
        setSuggestionGroups(data.groups || [])
      } else {
        setSuggestionGroups([])
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
      setSuggestionGroups([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  // Clear suggestions when loading starts, fetch when complete
  useEffect(() => {
    if (isLoading) {
      setSuggestionGroups([])
      return
    }

    if (!lastAssistantMessage) {
      return
    }

    // Wait a brief moment to ensure the message is fully complete
    const timer = setTimeout(() => {
      fetchSuggestions(lastAssistantMessage)
    }, 200)

    return () => clearTimeout(timer)
  }, [lastAssistantMessage, isLoading])

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

  // Reset clicked suggestions when we get a new complete question
  React.useEffect(() => {
    if (!lastAssistantMessage) return
    
    const trimmedMessage = lastAssistantMessage.trim()
    const seemsComplete = /[.!?]$/.test(trimmedMessage) || trimmedMessage.includes('?')
    
    if (seemsComplete) {
      setClickedSuggestions(new Set())
    }
  }, [lastAssistantMessage])

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
            <div className="flex gap-2 mb-2 items-end justify-start overflow-x-auto scrollbar-hide pb-1 sm:flex-wrap sm:overflow-x-visible">
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
                        className={`px-2 py-1 text-sm rounded border bg-transparent transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
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