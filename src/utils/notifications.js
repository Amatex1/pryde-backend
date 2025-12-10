// Play notification sound for new messages
export const playNotificationSound = () => {
  try {
    // Create an audio context
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create oscillator for a pleasant notification sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set frequency for a pleasant "ding" sound
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    // Set volume
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    // Play the sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log('Could not play notification sound:', error);
  }
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.log('Notification permission error:', error);
    }
  }
};

// Show browser notification using Service Worker (required for mobile)
export const showNotification = async (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Check if service worker is available
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;

        // Use Service Worker to show notification (works on mobile)
        await registration.showNotification(title, {
          icon: '/logo.png',
          badge: '/logo.png',
          vibrate: [200, 100, 200],
          ...options
        });
      } else {
        // Fallback for browsers without service worker support
        // This will fail on mobile, but that's expected
        console.log('Service Worker not supported, notification not shown');
      }
    } catch (error) {
      console.log('Could not show notification:', error);
    }
  }
};

