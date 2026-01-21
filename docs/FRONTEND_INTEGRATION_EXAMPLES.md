# Frontend Integration Examples

## Platform Safety & Observability Extensions

This document provides frontend integration examples for the backend safety and observability features.

---

## 1. Safe Mode Integration

### Check Safe Mode Status on Auth

```javascript
// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [safeModeEnabled, setSafeModeEnabled] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.get('/auth/status');
      
      if (response.data.authenticated) {
        setUser(response.data.user);
        setSafeModeEnabled(response.data.safeModeEnabled || false);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, safeModeEnabled, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Safe Mode Toggle Component

```javascript
// src/components/SafeModeToggle.jsx
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function SafeModeToggle() {
  const { safeModeEnabled, setSafeModeEnabled } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    
    try {
      const response = await api.put('/safe-mode/toggle');
      setSafeModeEnabled(response.data.safeModeEnabled);
      
      // Show success message
      alert(response.data.message);
      
      // Reload page to apply changes
      window.location.reload();
    } catch (error) {
      console.error('Failed to toggle Safe Mode:', error);
      alert('Failed to toggle Safe Mode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="safe-mode-toggle">
      <h3>Safe Mode</h3>
      <p>
        Disable PWA features, sockets, and optimistic UI for maximum stability.
        Use this if you're experiencing issues.
      </p>
      
      <button onClick={handleToggle} disabled={loading}>
        {loading ? 'Updating...' : safeModeEnabled ? 'Disable Safe Mode' : 'Enable Safe Mode'}
      </button>
      
      {safeModeEnabled && (
        <div className="safe-mode-warning">
          ⚠️ Safe Mode is enabled. Some features may be limited.
        </div>
      )}
    </div>
  );
}
```

### Conditional PWA Registration

```javascript
// src/index.jsx or src/main.jsx
import { registerServiceWorker } from './serviceWorkerRegistration';

// Check Safe Mode before registering service worker
async function initializeApp() {
  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'include'
    });
    
    const data = await response.json();
    
    // Only register service worker if Safe Mode is disabled
    if (!data.safeModeEnabled) {
      registerServiceWorker();
    } else {
      console.log('🔒 Safe Mode enabled - Service Worker disabled');
    }
  } catch (error) {
    console.error('Failed to check Safe Mode status:', error);
    // Default to registering service worker if check fails
    registerServiceWorker();
  }
}

initializeApp();
```

### Conditional Socket Connection

```javascript
// src/utils/socket.js
import { io } from 'socket.io-client';

let socket = null;

export function initializeSocket(safeModeEnabled) {
  // Don't connect socket if Safe Mode is enabled
  if (safeModeEnabled) {
    console.log('🔒 Safe Mode enabled - Socket connection disabled');
    return null;
  }

  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
  }

  return socket;
}

export function getSocket() {
  return socket;
}
```

---

## 2. Version Compatibility Checking

### Check Version on App Load

```javascript
// src/App.jsx
import { useEffect, useState } from 'react';
import api from './utils/api';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

function App() {
  const [versionCompatible, setVersionCompatible] = useState(true);
  const [updateRequired, setUpdateRequired] = useState(false);

  useEffect(() => {
    checkVersionCompatibility();
  }, []);

  const checkVersionCompatibility = async () => {
    try {
      const response = await api.post('/version/check', {
        frontendVersion: APP_VERSION
      });

      if (!response.data.compatible) {
        setVersionCompatible(false);
        setUpdateRequired(true);
      }
    } catch (error) {
      console.error('Version check failed:', error);
    }
  };

  if (updateRequired) {
    return (
      <div className="update-required">
        <h1>Update Required</h1>
        <p>A new version of Pryde is available. Please refresh to update.</p>
        <button onClick={() => window.location.reload()}>Refresh Now</button>
      </div>
    );
  }

  return (
    // Your app content
  );
}
```

### Add Version Header to API Requests

```javascript
// src/utils/api.js
import axios from 'axios';

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'X-Frontend-Version': APP_VERSION
  }
});

// Handle 426 Upgrade Required
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 426) {
      // Show update required message
      alert('App update required. Please refresh the page.');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 3. Admin Debug Tools Integration

### Admin Debug Panel Component

```javascript
// src/components/AdminDebugPanel.jsx
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function AdminDebugPanel() {
  const [pwaStatus, setPwaStatus] = useState(null);
  const [mutations, setMutations] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPWAStatus();
    fetchMutations();
  }, []);

  const fetchPWAStatus = async () => {
    try {
      const response = await api.get('/admin/debug/pwa/status');
      setPwaStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch PWA status:', error);
    }
  };

  const fetchMutations = async () => {
    try {
      const response = await api.get('/admin/debug/mutations/summary');
      setMutations(response.data);
    } catch (error) {
      console.error('Failed to fetch mutations:', error);
    }
  };

  const handleDisablePWA = async () => {
    setLoading(true);
    try {
      await api.post('/admin/debug/pwa/disable', {
        message: 'Emergency maintenance'
      });
      alert('PWA disabled successfully');
      fetchPWAStatus();
    } catch (error) {
      console.error('Failed to disable PWA:', error);
      alert('Failed to disable PWA');
    } finally {
      setLoading(false);
    }
  };

  const handleForceReload = async () => {
    setLoading(true);
    try {
      await api.post('/admin/debug/pwa/force-reload', {
        message: 'Critical update required'
      });
      alert('Force reload triggered');
      fetchPWAStatus();
    } catch (error) {
      console.error('Failed to force reload:', error);
      alert('Failed to force reload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-debug-panel">
      <h2>Admin Debug Tools</h2>

      {/* PWA Status */}
      <section>
        <h3>PWA Status</h3>
        {pwaStatus && (
          <div>
            <p>Enabled: {pwaStatus.pwaEnabled ? 'Yes' : 'No'}</p>
            <p>Force Reload: {pwaStatus.forceReload ? 'Yes' : 'No'}</p>
            <p>Message: {pwaStatus.maintenanceMessage || 'None'}</p>
            <p>Backend Version: {pwaStatus.backendVersion}</p>
            <p>Min Frontend Version: {pwaStatus.minFrontendVersion}</p>
          </div>
        )}
        
        <button onClick={handleDisablePWA} disabled={loading}>
          Disable PWA (Kill-Switch)
        </button>
        
        <button onClick={handleForceReload} disabled={loading}>
          Force All Clients to Reload
        </button>
      </section>

      {/* Mutation Queue */}
      <section>
        <h3>Mutation Queue</h3>
        {mutations && (
          <div>
            <p>Total: {mutations.total}</p>
            <p>Pending: {mutations.pending}</p>
            <p>Confirmed: {mutations.confirmed}</p>
            <p>Failed: {mutations.failed}</p>
            <p>Stuck: {mutations.stuck}</p>
            <p>High Retry: {mutations.highRetry}</p>
            
            {mutations.warnings.length > 0 && (
              <div className="warnings">
                <h4>Warnings</h4>
                {mutations.warnings.map((warning, i) => (
                  <div key={i} className="warning">
                    {warning.type}: {warning.entity} ({warning.mutationId})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
```

---

## 4. Environment Variables

Add to `.env`:

```bash
# App version (should match package.json)
VITE_APP_VERSION=1.2.3

# API URL
VITE_API_URL=https://api.pryde.social
```

---

## 5. CI Integration

Add to `.github/workflows/deploy.yml`:

```yaml
- name: Check Version Compatibility
  env:
    FRONTEND_VERSION: ${{ env.APP_VERSION }}
    BACKEND_URL: ${{ secrets.BACKEND_URL }}
  run: node scripts/check-version-compatibility.js
```

---

**Last Updated:** 2025-12-25  
**Status:** Ready for integration

