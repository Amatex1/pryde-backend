import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/darkMode.css'
import './styles/responsive.css'
import './styles/autoResponsive.css' // Auto-detect and adapt to all device sizes
import './styles/mobileFixes.css' // Mobile-specific fixes for color contrast and layout

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
