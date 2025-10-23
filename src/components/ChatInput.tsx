'use client'

import { useState, useRef, useEffect } from 'react'

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onFirstKeystroke?: () => void
  autoFocus?: boolean
  disabled?: boolean
}

export default function ChatInput({ onSendMessage, onFirstKeystroke, autoFocus = false, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [hasStartedTyping, setHasStartedTyping] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    <form onSubmit={handleSubmit} className="w-full">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type your response..."
        disabled={disabled}
        autoFocus
        className="w-full px-3 py-3 text-base sm:text-lg bg-secondary text-primary border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-opacity-50 resize-none placeholder-muted focus:border-subtle"
        style={{ 
          minHeight: '52px', 
          maxHeight: '200px',
          '--tw-ring-color': 'var(--accent)'
        }}
        rows={1}
      />
    </form>
  )
}