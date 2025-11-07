'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

export default function VoicePage() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [message, setMessage] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const connectionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number>()
  const audioQueueRef = useRef<string[]>([])
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef(false)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const transcriptRef = useRef<Array<{role: 'user' | 'assistant', content: string}>>([])
  const sessionStartTime = useRef<Date | null>(null)

  const playAudioFromBase64 = (base64Audio: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        
        // Decode base64 to binary PCM data
        const binaryString = atob(base64Audio)
        const pcmData = new Int16Array(binaryString.length / 2)
        
        // Convert binary string to 16-bit PCM
        for (let i = 0; i < pcmData.length; i++) {
          const byte1 = binaryString.charCodeAt(i * 2)
          const byte2 = binaryString.charCodeAt(i * 2 + 1) 
          pcmData[i] = byte1 | (byte2 << 8)
        }
        
        // Convert PCM to WAV format for browser playback
        const wavBuffer = pcmToWav(pcmData, 16000) // 16kHz sample rate
        const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' })
        const audioUrl = URL.createObjectURL(audioBlob)
        
        const audio = new Audio(audioUrl)
        currentAudioRef.current = audio
        
        audio.onplay = () => {
          setIsAISpeaking(true)
        }
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
          setIsAISpeaking(false)
          resolve()
        }
        
        audio.onerror = (err) => {
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
          setIsAISpeaking(false)
          reject(err)
        }
        
        audio.play().catch(reject)
        
      } catch (error) {
        reject(error)
      }
    })
  }

  const processAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return
    }

    isPlayingRef.current = true
    
    while (audioQueueRef.current.length > 0) {
      const audioChunk = audioQueueRef.current.shift()!
      try {
        await playAudioFromBase64(audioChunk)
      } catch (error) {
        // Skip failed audio chunks
      }
    }
    
    isPlayingRef.current = false
  }

  const queueAudioResponse = (base64Audio: string) => {
    audioQueueRef.current.push(base64Audio)
    processAudioQueue()
  }

  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    audioQueueRef.current = []
    isPlayingRef.current = false
    setIsAISpeaking(false)
  }

  const submitConversation = async () => {
    if (transcriptRef.current.length === 0) {
      return
    }

    try {
      const sessionDuration = sessionStartTime.current 
        ? Math.round((Date.now() - sessionStartTime.current.getTime()) / 1000)
        : 0

      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation: transcriptRef.current,
          latestResponse: transcriptRef.current[transcriptRef.current.length - 1]?.content || '',
          sessionDuration,
          isAbruptExit: false,
          isAutoSave: false
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit conversation')
      }
    } catch (error) {
      // Handle error silently
    }
  }
  
  const pcmToWav = (pcmData: Int16Array, sampleRate: number): ArrayBuffer => {
    const numChannels = 1 // Mono
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * bitsPerSample / 8
    const blockAlign = numChannels * bitsPerSample / 8
    const dataSize = pcmData.length * 2
    const bufferSize = 44 + dataSize
    
    const buffer = new ArrayBuffer(bufferSize)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    // RIFF chunk
    writeString(0, 'RIFF')
    view.setUint32(4, bufferSize - 8, true)
    writeString(8, 'WAVE')
    
    // fmt chunk
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // fmt chunk size
    view.setUint16(20, 1, true) // PCM format
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitsPerSample, true)
    
    // data chunk
    writeString(36, 'data')
    view.setUint32(40, dataSize, true)
    
    // PCM data
    const pcmView = new Int16Array(buffer, 44)
    pcmView.set(pcmData)
    
    return buffer
  }
  
  const playAudioViaWebAudio = async (audioBytes: Uint8Array) => {
    try {
      if (!audioContextRef.current) return
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioBytes.buffer.slice() as ArrayBuffer)
      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)
      source.start()
    } catch (webAudioError) {
      // Fallback handled elsewhere
    }
  }

  const startAudioStreaming = (ws: WebSocket, stream: MediaStream) => {
    if (!audioContextRef.current) return

    const audioContext = audioContextRef.current
    const source = audioContext.createMediaStreamSource(stream)
    
    // Create ScriptProcessorNode for raw PCM data capture
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    
    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return
      
      const inputBuffer = event.inputBuffer
      const inputData = inputBuffer.getChannelData(0) // Get mono channel
      
      // Convert Float32 to Int16 (PCM S16LE format)
      const pcmData = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        // Convert float (-1 to 1) to 16-bit signed integer (-32768 to 32767)
        pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
      }
      
      // Convert to base64
      const buffer = new ArrayBuffer(pcmData.length * 2)
      const view = new Uint8Array(buffer)
      const dataView = new DataView(buffer)
      
      for (let i = 0; i < pcmData.length; i++) {
        dataView.setInt16(i * 2, pcmData[i], true) // little-endian
      }
      
      const base64 = btoa(String.fromCharCode(...view))
      
      const audioMessage = {
        user_audio_chunk: base64
      }
      ws.send(JSON.stringify(audioMessage))
    }
    
    // Connect the audio graph
    source.connect(processor)
    processor.connect(audioContext.destination)
    
    // Store processor for cleanup
    return processor
  }

  const startAudioMonitoring = () => {
    if (!analyserRef.current) return
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    
    let frameCount = 0
    const updateAudioLevel = () => {
      if (!analyserRef.current) return
      
      analyserRef.current.getByteFrequencyData(dataArray)
      
      // Calculate average audio level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
      const normalizedLevel = Math.min(average / 100, 1) // Normalize to 0-1
      
      setAudioLevel(normalizedLevel)
      setIsListening(normalizedLevel > 0.1) // Consider listening if above threshold
      
      frameCount++
      
      animationRef.current = requestAnimationFrame(updateAudioLevel)
    }
    
    updateAudioLevel()
  }

  const startVoiceConversation = async () => {
    setIsConnecting(true)
    setMessage('Connecting to ElevenLabs...')
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const audioTracks = stream.getAudioTracks()
      
      if (audioTracks.length > 0 && audioTracks[0].muted) {
        setMessage('⚠️ Microphone is muted. Please check your system settings and refresh the page.')
      }
      
      // Set up audio context with 16kHz sample rate for ElevenLabs
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      })
      
      // Resume audio context if suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      
      startAudioMonitoring()
      
      // Start conversation with API
      const response = await fetch('/api/elevenlabs/conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start conversation')
      }
      
      setMessage('Loading ElevenLabs SDK...')
      
      // Use ElevenLabs Conversation class for real-time voice conversation
      await import('@elevenlabs/client')
      
      setMessage('Attempting WebSocket connection...')
      
      try {
        const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${data.agent_id}`
        const ws = new WebSocket(wsUrl)
        
        ws.onopen = () => {
          // Start session timer
          sessionStartTime.current = new Date()
          
          // Clear previous transcript
          transcriptRef.current = []
          
          // Try simpler authentication approach
          const authMessage = {
            type: 'auth',
            api_key: data.api_key
          }
          
          ws.send(JSON.stringify(authMessage))
          
          // Wait a moment then send agent init
          setTimeout(() => {
            const initMessage = {
              type: 'init_conversation',
              agent_id: data.agent_id
            }
            ws.send(JSON.stringify(initMessage))
          }, 100)
          
          setIsConnecting(false)
          setIsConnected(true)
          setMessage('Voice conversation active! Start speaking...')
        }
        
        ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data)
            
            // Handle different message types from ElevenLabs
            if (response.agent_response_event && response.agent_response_event.agent_response) {
              transcriptRef.current.push({
                role: 'assistant',
                content: response.agent_response_event.agent_response
              })
            }
            
            if (response.user_transcription_event && response.user_transcription_event.user_transcript && 
                response.user_transcription_event.user_transcript !== '...') {
              transcriptRef.current.push({
                role: 'user', 
                content: response.user_transcription_event.user_transcript
              })
            }
            
            if (response.audio_event && response.audio_event.audio_base_64) {
              queueAudioResponse(response.audio_event.audio_base_64)
            }
            
            if (response.ping_event) {
              // Respond to ping with pong
              ws.send(JSON.stringify({ 
                type: 'pong',
                event_id: response.ping_event.event_id 
              }))
            }
            
          } catch (e) {
            // Skip non-JSON messages
          }
        }
        
        ws.onerror = (error: Event) => {
          setIsConnecting(false)
          setIsConnected(false)
          setMessage('Connection error occurred')
        }
        
        ws.onclose = async () => {
          await submitConversation()
          setIsConnected(false)
          setMessage('Conversation ended - data submitted to Google Sheets')
        }
        
        connectionRef.current = ws
        
        // Start streaming audio from microphone
        processorRef.current = startAudioStreaming(ws, stream)
        
      } catch (connectionError) {
        throw connectionError
      }
      
    } catch (error) {
      setIsConnecting(false)
      setIsConnected(false)
      setMessage(`Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const endConversation = async () => {
    // Submit conversation data before closing
    await submitConversation()
    
    if (connectionRef.current) {
      connectionRef.current.close()
      connectionRef.current = null
    }
    
    // Stop audio monitoring
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Stop any current audio playback
    stopCurrentAudio()
    
    // Cleanup audio processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    setIsConnected(false)
    setConversationId(null)
    setIsListening(false)
    setAudioLevel(0)
    setIsAISpeaking(false)
    setMessage('Conversation ended - data submitted to Google Sheets')
  }

  const toggleMute = () => {
    if (connectionRef.current) {
      // Toggle mute functionality
      setIsMuted(!isMuted)
      // Note: Mute functionality depends on the specific ElevenLabs API
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.close()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      stopCurrentAudio()
      
      // Cleanup audio processor
      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }
    }
  }, [])

  return (
    <div className="min-h-[100dvh] bg-primary flex items-center justify-center">
      <div className="text-center">
        {/* Voice Orb */}
        <div className="mb-8">
          <div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
            isConnected 
              ? isAISpeaking
                ? 'bg-blue-50 border-4 border-blue-400 shadow-lg'
                : isListening
                  ? 'bg-red-50 border-4 border-red-400 shadow-lg' 
                  : 'bg-green-50 border-4 border-green-300'
              : isConnecting 
              ? 'bg-secondary border-4 border-muted animate-pulse' 
              : 'bg-secondary border-4 border-muted'
          }`} style={{
            transform: isListening ? `scale(${1 + audioLevel * 0.3})` : isAISpeaking ? 'scale(1.1)' : 'scale(1)'
          }}>
            <svg className={`w-16 h-16 transition-colors ${
              isConnected 
                ? isAISpeaking
                  ? 'text-blue-600'
                  : isListening 
                    ? 'text-red-600' 
                    : 'text-green-600' 
                  : isConnecting 
                  ? 'text-muted' 
                  : 'text-muted'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          
          {/* Voice activity indicator */}
          {isConnected && (
            <div className="mt-4">
              <div className="w-48 mx-auto bg-secondary rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-100 ${
                    isAISpeaking ? 'bg-blue-500' : 'bg-red-500'
                  }`}
                  style={{ width: isAISpeaking ? '100%' : `${audioLevel * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Start Button */}
        {!isConnected && (
          <button
            onClick={startVoiceConversation}
            disabled={isConnecting}
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
          >
            {isConnecting ? 'Connecting...' : 'Start'}
          </button>
        )}

        {/* Subtle Stop Button */}
        {isConnected && (
          <button 
            onClick={endConversation}
            className="px-6 py-2 text-muted hover:text-secondary transition-colors text-sm"
          >
            Stop
          </button>
        )}
      </div>

      {/* Back to Text Chat - positioned in top left */}
      <Link 
        href="/" 
        className="absolute top-4 left-4 flex items-center text-muted hover:text-secondary transition-colors text-sm"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>
    </div>
  )
}