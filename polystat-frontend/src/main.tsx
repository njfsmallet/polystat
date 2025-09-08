import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import App from './App';
import './index.css';

const QUERY_CONFIG = {
  retry: 3,
  refetchOnWindowFocus: false,
  staleTime: 30000, // 30 seconds
} as const;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: QUERY_CONFIG,
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
