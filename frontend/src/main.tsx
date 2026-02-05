import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.tsx'
import './index.css'

// Create a React Query client with default options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered "fresh"
      staleTime: 5 * 60 * 1000, // 5 minutes
      // GC time: how long inactive data remains in cache
      gcTime: 10 * 60 * 1000, // 10 minutes
      // Retry failed requests
      retry: 1,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
