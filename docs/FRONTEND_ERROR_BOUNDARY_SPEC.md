# Frontend Error Boundary & Monitoring Specification

**Date:** 2026-01-12  
**Objective:** Catch and report frontend errors without crashing the app  
**Scope:** React Error Boundaries, error reporting, user feedback

---

## REACT ERROR BOUNDARY

### Implementation

```javascript
// components/ErrorBoundary.jsx

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }
  
  static getDerivedStateFromError(error) {
    // Update state so next render shows fallback UI
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });
  }
  
  logErrorToService(error, errorInfo) {
    // Only log in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error caught by boundary:', error, errorInfo);
      return;
    }
    
    // Sanitize error (no PII)
    const sanitizedError = {
      message: this.sanitizeMessage(error.message),
      stack: error.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines
      componentStack: errorInfo.componentStack?.split('\n').slice(0, 5).join('\n'),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Send to backend monitoring endpoint
    fetch('/api/monitoring/frontend-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitizedError)
    }).catch(err => {
      // Silently fail if reporting fails
      console.error('Failed to report error:', err);
    });
  }
  
  sanitizeMessage(message) {
    if (!message) return 'Unknown error';
    
    // Remove email addresses
    let sanitized = message.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
    
    // Remove tokens
    sanitized = sanitized.replace(/[A-Za-z0-9-_]{20,}/g, '[TOKEN]');
    
    // Remove IDs
    sanitized = sanitized.replace(/[0-9a-f]{24}/g, '[ID]');
    
    return sanitized;
  }
  
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <div className="error-content">
            <h2>Something went wrong</h2>
            <p>We're sorry for the inconvenience. The error has been reported to our team.</p>
            
            <div className="error-actions">
              <button onClick={this.handleReset} className="btn-primary">
                Try Again
              </button>
              <button onClick={() => window.location.href = '/'} className="btn-secondary">
                Go Home
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details (Dev Only)</summary>
                <pre>{this.state.error?.toString()}</pre>
                <pre>{this.state.errorInfo?.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary;
```

### Usage

```javascript
// App.jsx

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Your routes */}
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
```

---

## FRONTEND MONITORING UTILITIES

### Socket Health Monitoring

```javascript
// utils/socketMonitoring.js

class SocketMonitor {
  constructor() {
    this.metrics = {
      connections: 0,
      disconnections: 0,
      reconnects: 0,
      errors: 0,
      lastConnected: null,
      lastDisconnected: null
    };
  }
  
  trackConnection() {
    this.metrics.connections++;
    this.metrics.lastConnected = new Date().toISOString();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[SocketMonitor] Connected', this.metrics);
    }
  }
  
  trackDisconnection() {
    this.metrics.disconnections++;
    this.metrics.lastDisconnected = new Date().toISOString();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[SocketMonitor] Disconnected', this.metrics);
    }
  }
  
  trackReconnect() {
    this.metrics.reconnects++;
    
    // Alert if reconnects are frequent
    if (this.metrics.reconnects > 5) {
      console.warn('[SocketMonitor] Frequent reconnects detected:', this.metrics.reconnects);
    }
  }
  
  trackError(error) {
    this.metrics.errors++;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('[SocketMonitor] Error:', error);
    }
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  reset() {
    this.metrics = {
      connections: 0,
      disconnections: 0,
      reconnects: 0,
      errors: 0,
      lastConnected: null,
      lastDisconnected: null
    };
  }
}

export const socketMonitor = new SocketMonitor();
```

### Usage in Socket Setup

```javascript
import { socketMonitor } from '../utils/socketMonitoring';

socket.on('connect', () => {
  socketMonitor.trackConnection();
});

socket.on('disconnect', () => {
  socketMonitor.trackDisconnection();
});

socket.on('reconnect', () => {
  socketMonitor.trackReconnect();
});

socket.on('error', (error) => {
  socketMonitor.trackError(error);
});
```

---

## BACKEND ERROR REPORTING ENDPOINT

```javascript
// routes/monitoring.js

const express = require('express');
const router = express.Router();
const monitor = require('../utils/productionMonitoring');

/**
 * Frontend error reporting endpoint
 */
router.post('/frontend-error', (req, res) => {
  try {
    const { message, stack, componentStack, timestamp, userAgent, url } = req.body;
    
    // Log sanitized error
    console.error('[Frontend Error]', {
      message,
      stack: stack?.split('\n')[0], // First line only
      timestamp,
      userAgent: userAgent?.substring(0, 50), // Truncate
      url: url?.replace(/\?.*/g, '') // Remove query params
    });
    
    // Track in metrics
    monitor.trackUnhandledException({ name: 'FrontendError', message });
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Frontend Error] Failed to log:', error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
```

---

## ACCEPTANCE CRITERIA

✅ **Error Boundary**
- Catches React errors
- Shows user-friendly fallback UI
- Reports errors to backend
- No PII in error reports

✅ **Socket Monitoring**
- Tracks connections/disconnections
- Tracks reconnects
- Alerts on frequent reconnects
- No performance impact

✅ **Error Reporting**
- Sanitized error messages
- No tokens or emails
- Backend endpoint receives errors
- Silent failures in production

✅ **User Experience**
- App doesn't crash
- Clear error messages
- Recovery options provided
- Dev mode shows details

---

## TESTING

### Test Error Boundary

```javascript
// Test component that throws error
function BrokenComponent() {
  throw new Error('Test error');
}

// Wrap in error boundary
<ErrorBoundary>
  <BrokenComponent />
</ErrorBoundary>
```

### Test Socket Monitoring

```javascript
// Simulate socket events
socket.emit('connect');
socket.emit('disconnect');
socket.emit('reconnect');

// Check metrics
console.log(socketMonitor.getMetrics());
```

---

**Status:** Ready for implementation  
**Next Step:** Add error boundary to frontend and monitoring endpoint to backend

