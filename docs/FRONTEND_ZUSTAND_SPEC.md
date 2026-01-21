# Frontend Global State Management - Zustand Implementation Spec

## Overview
Replace Context API with Zustand for better performance and simpler state management.

## Installation
```bash
npm install zustand
```

## Store Structure

### 1. Auth Store (`src/stores/authStore.js`)
```javascript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      setAuth: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: true 
      }),
      
      logout: () => set({ 
        user: null, 
        token: null, 
        isAuthenticated: false 
      }),
      
      updateUser: (updates) => set((state) => ({
        user: { ...state.user, ...updates }
      }))
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token 
      })
    }
  )
);
```

### 2. Notification Store (`src/stores/notificationStore.js`)
```javascript
import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  setNotifications: (notifications) => set({ 
    notifications,
    unreadCount: notifications.filter(n => !n.read).length
  }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + 1
  })),
  
  markAsRead: (notificationId) => set((state) => ({
    notifications: state.notifications.map(n =>
      n._id === notificationId ? { ...n, read: true } : n
    ),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),
  
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0
  })),
  
  clearNotifications: () => set({ 
    notifications: [], 
    unreadCount: 0 
  })
}));
```

### 3. Message Store (`src/stores/messageStore.js`)
```javascript
import { create } from 'zustand';

export const useMessageStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  unreadCount: 0,
  
  setConversations: (conversations) => set({ conversations }),
  
  setActiveConversation: (conversationId) => set({ 
    activeConversation: conversationId 
  }),
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),
  
  updateUnreadCount: (count) => set({ unreadCount: count })
}));
```

### 4. Socket Store (`src/stores/socketStore.js`)
```javascript
import { create } from 'zustand';

export const useSocketStore = create((set, get) => ({
  socket: null,
  isConnected: false,
  
  setSocket: (socket) => set({ socket }),
  
  setConnected: (isConnected) => set({ isConnected }),
  
  emit: (event, data) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit(event, data);
    }
  }
}));
```

## Migration Guide

### Before (Context API)
```javascript
// AuthContext.jsx
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // ... complex state logic
  
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Usage
const { user } = useContext(AuthContext);
```

### After (Zustand)
```javascript
// No provider needed!

// Usage
import { useAuthStore } from './stores/authStore';

const user = useAuthStore((state) => state.user);
const setAuth = useAuthStore((state) => state.setAuth);
```

## Benefits

1. **No Provider Hell** - No need to wrap components in providers
2. **Better Performance** - Only re-renders components that use changed state
3. **Simpler Code** - Less boilerplate, more readable
4. **DevTools** - Built-in Redux DevTools support
5. **Persistence** - Easy localStorage persistence with middleware

## Implementation Steps

1. Install Zustand: `npm install zustand`
2. Create stores in `src/stores/` directory
3. Replace Context imports with Zustand hooks
4. Remove Context providers from App.jsx
5. Test all functionality
6. Remove old Context files

## Performance Comparison

| Metric | Context API | Zustand |
|--------|-------------|---------|
| Re-renders | All consumers | Only subscribers |
| Bundle size | 0 KB (built-in) | 1.2 KB |
| Boilerplate | High | Low |
| DevTools | No | Yes |
| Persistence | Manual | Built-in |

## Testing

```javascript
// Test store
import { useAuthStore } from './stores/authStore';

describe('Auth Store', () => {
  it('should set auth', () => {
    const { setAuth, user } = useAuthStore.getState();
    setAuth({ id: '123', name: 'Test' }, 'token');
    expect(useAuthStore.getState().user.id).toBe('123');
  });
});
```

