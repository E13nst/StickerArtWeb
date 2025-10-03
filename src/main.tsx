import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.tsx'
import './index.css'

// Создаем тему Material-UI с яркой палитрой под картинку
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#00BCD4', // Бирюзовый/cyan - основной цвет лица
      light: '#4DD0E1',
      dark: '#0097A7',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#E91E63', // Ярко-розовый/magenta - левая часть сплеша
      light: '#F06292',
      dark: '#C2185B',
      contrastText: '#ffffff',
    },
    background: {
      default: '#ffffff',
      paper: '#F8F9FA',
    },
    text: {
      primary: '#2C3E50', // Темно-синий для контраста
      secondary: '#6C757D',
    },
    // Дополнительные цвета из картинки
    info: {
      main: '#9C27B0', // Фиолетовый - основа сплеша
      light: '#BA68C8',
      dark: '#7B1FA2',
    },
    warning: {
      main: '#FF9800', // Оранжевый - правые акценты
      light: '#FFB74D',
      dark: '#F57C00',
    },
    success: {
      main: '#FFC107', // Ярко-желтый - правые акценты
      light: '#FFD54F',
      dark: '#FF8F00',
    },
    error: {
      main: '#E91E63', // Используем розовый для ошибок
    },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontWeightBold: 600,
  },
  shape: {
    borderRadius: 16, // Более округлые углы для современного вида
  },
  // Кастомные компоненты
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0, 188, 212, 0.3)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0, 188, 212, 0.4)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(0, 188, 212, 0.15)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          fontWeight: 600,
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
