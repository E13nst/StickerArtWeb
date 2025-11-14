import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/stixly-header.css'
import { isIOS } from './utils/platform'
import { initTelegramHeaderColor } from './telegram/headerColor'

// iOS detection and body class setup
if (isIOS) {
  document.body.classList.add('ios', 'platform-ios')
  console.log('[Stixly] iOS detected. Using stixlytopheader.')
} else {
  console.log('[Stixly] Non-iOS platform.')
}

// Initialize Telegram header color
initTelegramHeaderColor('#0E0F1A')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
