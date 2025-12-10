// src/utils/pushNotifications.js

let isSubscribed = false;

/* -------------------------------------------
   CHECK SUBSCRIPTION STATE
--------------------------------------------*/
export const isPushNotificationSubscribed = () => {
  return isSubscribed;
};

/* -------------------------------------------
   SUBSCRIBE
--------------------------------------------*/
export const subscribeToPushNotifications = async () => {
  console.log("🔔 Subscribing user to push notifications...");

  try {
    // Simulated subscription process
    // In a real implementation, this would:
    // 1. Request notification permission
    // 2. Subscribe to push service
    // 3. Send subscription to backend
    isSubscribed = true;
    return true;
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    return false;
  }
};

/* -------------------------------------------
   UNSUBSCRIBE
--------------------------------------------*/
export const unsubscribeFromPushNotifications = async () => {
  console.log("🔕 Unsubscribing user from push notifications...");

  try {
    // Simulated unsubscription process
    isSubscribed = false;
    return true;
  } catch (error) {
    console.error("Failed to unsubscribe from push notifications:", error);
    return false;
  }
};

/* -------------------------------------------
   SEND TEST NOTIFICATION
--------------------------------------------*/
export const sendTestNotification = async () => {
  console.log("📨 Sending test notification...");

  try {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications");
      return false;
    }

    // Check if service worker is supported
    if (!("serviceWorker" in navigator)) {
      alert("This browser does not support service workers");
      return false;
    }

    // Request permission if not granted
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Notification permission denied");
        return false;
      }
    }

    // Check if permission is granted
    if (Notification.permission === "granted") {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Use Service Worker to show notification (works on mobile)
      await registration.showNotification("Pryde Social Test Notification", {
        body: "Push notifications are working! 🎉",
        icon: "/logo192.png",
        badge: "/logo192.png",
        tag: "test-notification",
        requireInteraction: false,
        vibrate: [200, 100, 200]
      });

      return true;
    } else {
      alert("Notification permission is denied. Please enable notifications in your browser settings.");
      return false;
    }
  } catch (error) {
    console.error("Failed to send test notification:", error);
    alert("Failed to send test notification: " + error.message);
    return false;
  }
};
