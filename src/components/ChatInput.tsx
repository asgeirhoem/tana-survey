'use client'

import { useState, useRef, useEffect, forwardRef, useMemo } from 'react'
import React from 'react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onFirstKeystroke?: () => void
  autoFocus?: boolean
  disabled?: boolean
  isSessionEnding?: boolean
  lastAssistantMessage?: string
}

const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(function ChatInput({ onSendMessage, onFirstKeystroke, autoFocus = false, disabled = false, isSessionEnding = false, lastAssistantMessage = '' }, ref) {
  const [message, setMessage] = useState('')
  const [hasStartedTyping, setHasStartedTyping] = useState(false)
  const [clickedSuggestions, setClickedSuggestions] = useState<Set<string>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Generate suggestions based on the last assistant message
  const getSuggestions = (assistantMessage: string): string[] => {
    const lowerMsg = assistantMessage.toLowerCase()
    
    // Location/setup questions
    if (lowerMsg.includes('remote') || lowerMsg.includes('office') || lowerMsg.includes('location') || lowerMsg.includes('where')) {
      return ['Remote', 'SF', 'NY', 'London', 'Hybrid', 'Office', 'Berlin']
    }
    
    // Project management tools
    if (lowerMsg.includes('project management') || lowerMsg.includes('track project')) {
      return ['Linear', 'Jira', 'Trello', 'Asana', 'Monday', 'Notion', 'ClickUp']
    }
    
    // Documentation tools
    if (lowerMsg.includes('documentation') || lowerMsg.includes('document')) {
      return ['Notion', 'Confluence', 'GitBook', 'Slab', 'Coda', 'Obsidian', 'Roam']
    }
    
    // Communication tools
    if (lowerMsg.includes('communication') || lowerMsg.includes('chat') || lowerMsg.includes('messaging')) {
      return ['Slack', 'Discord', 'Teams', 'Telegram', 'WhatsApp', 'Zoom', 'Meet']
    }
    
    // Team size
    if (lowerMsg.includes('team size') || lowerMsg.includes('how many people')) {
      return ['2-5', '6-10', '11-25', '26-50', '51-100', '100+', 'Just me']
    }
    
    // Company stage
    if (lowerMsg.includes('stage') || lowerMsg.includes('funding')) {
      return ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Growth', 'Bootstrap', 'Revenue']
    }
    
    // Role
    if (lowerMsg.includes('role') || lowerMsg.includes('what do you do')) {
      return ['CEO', 'CTO', 'Founder', 'Engineer', 'Designer', 'Product', 'Marketing']
    }
    
    // AI usage
    if (lowerMsg.includes('ai') || lowerMsg.includes('artificial intelligence')) {
      return ['ChatGPT', 'Claude', 'Copilot', 'Cursor', 'None', 'Custom tools', 'OpenAI API']
    }
    
    return []
  }

  const suggestions = useMemo(() => getSuggestions(lastAssistantMessage).slice(0, 7), [lastAssistantMessage])

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
    const currentSuggestions = suggestions.filter(suggestion => 
      message.split(',').map(s => s.trim()).includes(suggestion)
    )
    setClickedSuggestions(new Set(currentSuggestions))
  }, [message, suggestions])

  // Reset clicked suggestions when assistant message changes (new question)
  React.useEffect(() => {
    setClickedSuggestions(new Set())
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
      setClickedSuggestions(new Set()) // Clear suggestions when user sends message
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
      {/* Suggestions */}
      {suggestions.length > 0 && !isSessionEnding && (
        <div className="mb-1">
          <div className="flex flex-wrap gap-2 mb-2">
            {suggestions.map((suggestion, index) => {
              const isClicked = clickedSuggestions.has(suggestion)
              return (
                <button
                  key={index}
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
              )
            })}
          </div>
        </div>
      )}
      
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
            className="w-full px-4 py-4 text-base bg-secondary text-primary rounded-lg focus:outline-none resize-none placeholder-muted focus:shadow-[0_0_0_2px_#007AFF] transition-shadow duration-200 sm:px-3 sm:py-3"
            style={{ 
              minHeight: '56px', 
              maxHeight: '200px',
              boxShadow: '0 0 0 1px var(--border-subtle)'
            } as React.CSSProperties}
            rows={1}
          />
          {/* Submit button hidden on mobile, visible on desktop */}
          <button
            type="submit"
            disabled={!message.trim() || disabled || isSessionEnding}
            className="hidden sm:block absolute right-3 top-3 mt-[6px] text-muted hover:text-primary transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
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