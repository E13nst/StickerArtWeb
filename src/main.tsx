import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.tsx'
import './index.css'
import './styles/space.css'
import './styles/ui-baseline.css'

// Современная минималистичная тема уровня Instagram/Telegram
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00C6FF', // Современный синий акцент
      light: '#4DD0E1',
      dark: '#0072FF',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6B7280', // Нейтральный серый
      light: '#9CA3AF',
      dark: '#374151',
      contrastText: '#ffffff',
    },
    background: {
      default: '#F9FAFB', // Светло-серый фон
      paper: '#ffffff',
    },
    text: {
      primary: '#111827', // Темный текст
      secondary: '#6B7280', // Серый текст
    },
    info: {
      main: '#00C6FF',
      light: '#4DD0E1',
      dark: '#0072FF',
    },
    warning: {
      main: '#F59E0B',
      light: '#FCD34D',
      dark: '#D97706',
    },
    success: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
      dark: '#DC2626',
    },
  },
  typography: {
    fontFamily: 'Inter, Rubik, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontWeightBold: 600,
    h1: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.75rem',
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 20, // Современные округлые углы
  },
  // Кастомные компоненты в современном стиле
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0, 198, 255, 0.15)',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 6px 16px rgba(0, 198, 255, 0.25)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          transition: 'all 0.25s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 18px rgba(0, 0, 0, 0.08)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
          backgroundColor: '#F1F5F9',
          color: '#111827',
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: '#E0F7FF',
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
        },
      },
    },
  },
})

// Создаем QueryClient для React Query
const queryClient = new QueryClient({
  defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 минут
          gcTime: 10 * 60 * 1000, // 10 минут
        },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
