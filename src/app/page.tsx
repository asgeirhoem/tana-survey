import SurveyChat from '../components/SurveyChat'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-primary">
      {/* Voice Mode Buttons */}
      <div className="p-4 flex justify-end space-x-3">
        <Link 
          href="/voice"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Voice Mode
        </Link>
        
      </div>
      
      {/* Original Survey Chat */}
      <SurveyChat />
    </main>
  )
}