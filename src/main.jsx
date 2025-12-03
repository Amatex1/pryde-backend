import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/darkMode.css'
import './styles/quiet-mode.css' // MUST be loaded AFTER darkMode.css to override properly
import './styles/responsive.css'
import './styles/autoResponsive.css' // Auto-detect and adapt to all device sizes
import './styles/mobileFixes.css' // Mobile-specific fixes for color contrast and layout
import { registerServiceWorker, setupInstallPrompt } from './utils/pwa'

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  registerServiceWorker();
  setupInstallPrompt();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
