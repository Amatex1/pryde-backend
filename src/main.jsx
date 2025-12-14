import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/darkMode.css'
import './styles/quiet-mode.css' // MUST be loaded AFTER darkMode.css to override properly
import { registerServiceWorker, setupInstallPrompt, requestPersistentStorage } from './utils/pwa'

// Register service worker for PWA functionality (production only)
if (import.meta.env.PROD) {
  // Register service worker
  registerServiceWorker().catch(err => {
    console.error('[PWA] Service worker registration failed:', err);
  });

  // Setup install prompt
  setupInstallPrompt();

  // Request persistent storage using modern Storage API
  // This replaces the deprecated StorageType.persistent API
  requestPersistentStorage().catch(err => {
    console.error('[PWA] Persistent storage request failed:', err);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
