import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { HotelProvider } from './context/HotelContext';
import { ThemeProvider } from './context/ThemeContext';

const queryClient = new QueryClient({
  // Surface failed loads; otherwise pages render empty/zero states that look like real data
  queryCache: new QueryCache({
    onError: (err) => {
      if (err.response?.status === 401) return; // axios interceptor redirects to login
      toast.error(err.response?.data?.message || 'Could not load data. Check your connection and try again.', { id: 'query-error' });
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <HotelProvider>
              <App />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    borderRadius: '12px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'rgb(var(--ink))',
                    background: '#ffffff',
                    border: '1px solid rgb(var(--ink-200))',
                  },
                  success: { iconTheme: { primary: 'rgb(var(--brand-600))', secondary: '#ffffff' } },
                  error: { iconTheme: { primary: '#b91c1c', secondary: '#ffffff' } },
                }}
              />
            </HotelProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
