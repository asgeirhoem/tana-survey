'use client'

import { useState } from 'react'

export default function ElevenLabsTest() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const testConnection = async () => {
    setIsLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/elevenlabs/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setIsConnected(true)
        setMessage('✅ Successfully connected to ElevenLabs agent!')
      } else {
        setIsConnected(false)
        setMessage(`❌ Connection failed: ${data.error}`)
      }
    } catch (error) {
      setIsConnected(false)
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">ElevenLabs Test</h2>
      
      <button
        onClick={testConnection}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Testing Connection...' : 'Test ElevenLabs Connection'}
      </button>
      
      {message && (
        <div className={`mt-4 p-3 rounded-lg ${
          isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}