'use client'

import { memo } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatMessageProps {
  message: Message
}

function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  
  return (
    <div className={`mb-8 ${isUser ? 'text-right' : 'text-left'}`}>
      <div className={`inline-block max-w-full sm:max-w-2xl ${isUser ? 'text-secondary' : 'text-primary'}`}>
        <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    </div>
  )
}

export default memo(ChatMessage, (prevProps, nextProps) => {
  return prevProps.message.content === nextProps.message.content
})