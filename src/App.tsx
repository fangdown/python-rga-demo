import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { getRagBaseURL } from './api/client'
import { ChatPanel } from './components/ChatPanel'
import { DocumentSidebar } from './components/DocumentSidebar'
import './rag-layout.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  const [toast, setToast] = useState<{ text: string; kind: 'error' } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 5200)
    return () => window.clearTimeout(t)
  }, [toast])

  const base = useMemo(() => getRagBaseURL(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <div className="rag-shell">
        <DocumentSidebar
          onError={(msg) => setToast({ text: msg, kind: 'error' })}
        />
        <ChatPanel
          onError={(msg) => setToast({ text: msg, kind: 'error' })}
        />
      </div>
      <footer className="rag-api-badge" title={base}>
        API: {base}
      </footer>
      {toast && (
        <div
          className="rag-toast"
          role="status"
        >
          {toast.text}
        </div>
      )}
    </QueryClientProvider>
  )
}
