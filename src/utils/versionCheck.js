/**
 * Version Check Utility
 * Automatically detects new deployments and prompts user to refresh
 */

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const BUILD_VERSION_KEY = 'app_build_version';

/**
 * Get the current build version from the HTML meta tag
 * This is set during build time
 */
export const getCurrentBuildVersion = () => {
  const metaTag = document.querySelector('meta[name="build-version"]');
  return metaTag?.content || 'unknown';
};

/**
 * Get the stored build version from localStorage
 */
export const getStoredBuildVersion = () => {
  return localStorage.getItem(BUILD_VERSION_KEY);
};

/**
 * Store the current build version
 */
export const storeBuildVersion = (version) => {
  localStorage.setItem(BUILD_VERSION_KEY, version);
};

/**
 * Check if a new version is available
 * Returns true if the current build version differs from stored version
 */
export const isNewVersionAvailable = () => {
  const currentVersion = getCurrentBuildVersion();
  const storedVersion = getStoredBuildVersion();
  
  // First time visiting - store version and return false
  if (!storedVersion) {
    storeBuildVersion(currentVersion);
    return false;
  }
  
  // Version changed - new deployment detected
  return currentVersion !== storedVersion && currentVersion !== 'unknown';
};

/**
 * Show a toast notification prompting user to refresh
 */
export const promptUserToRefresh = () => {
  // Prevent duplicate toasts
  const existingToast = document.getElementById('version-update-toast');
  if (existingToast) {
    console.log('⚠️ Update notification already showing');
    return;
  }

  // Create a custom toast notification
  const toast = document.createElement('div');
  toast.id = 'version-update-toast';
  toast.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">🎉</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">New Update Available!</div>
          <div style="font-size: 14px; opacity: 0.9;">A new version of Pryde Social is ready.</div>
        </div>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button id="refresh-now-btn" style="
          background: white;
          color: #667eea;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          flex: 1;
          transition: transform 0.2s;
        ">
          Refresh Now
        </button>
        <button id="refresh-later-btn" style="
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        ">
          Later
        </button>
      </div>
    </div>
    <style>
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      #refresh-now-btn:hover {
        transform: scale(1.05);
      }
      #refresh-later-btn:hover {
        transform: scale(1.05);
      }
    </style>
  `;
  
  document.body.appendChild(toast);

  // Add event listeners after DOM insertion
  // Use setTimeout to ensure DOM is ready
  setTimeout(() => {
    const refreshNowBtn = document.getElementById('refresh-now-btn');
    const refreshLaterBtn = document.getElementById('refresh-later-btn');

    if (refreshNowBtn) {
      refreshNowBtn.addEventListener('click', () => {
        console.log('🔄 Refreshing page...');
        // Update stored version before reload to prevent loop
        storeBuildVersion(getCurrentBuildVersion());
        window.location.reload(true); // Hard reload
      });
    }

    if (refreshLaterBtn) {
      refreshLaterBtn.addEventListener('click', () => {
        console.log('⏰ User chose to refresh later');
        toast.remove();
      });
    }
  }, 0);
  
  // Auto-remove after 30 seconds if user doesn't interact
  setTimeout(() => {
    const existingToast = document.getElementById('version-update-toast');
    if (existingToast) {
      console.log('⏰ Auto-dismissing update notification');
      existingToast.remove();
    }
  }, 30000);
};

/**
 * Start periodic version checking
 * Call this once when the app initializes
 */
export const startVersionCheck = () => {
  // Check immediately on load
  if (isNewVersionAvailable()) {
    console.log('🎉 New version detected!');
    promptUserToRefresh();
    return;
  }
  
  // Then check periodically
  setInterval(() => {
    console.log('🔍 Checking for new version...');
    
    // Fetch the current index.html to check meta tag
    fetch('/', { 
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(response => response.text())
      .then(html => {
        // Parse the HTML to extract build version
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const metaTag = doc.querySelector('meta[name="build-version"]');
        const newVersion = metaTag?.content;
        
        if (newVersion && newVersion !== getCurrentBuildVersion()) {
          console.log('✅ New version available:', newVersion);
          promptUserToRefresh();
        } else {
          console.log('✅ Already on latest version');
        }
      })
      .catch(err => {
        console.error('❌ Version check failed:', err);
      });
  }, VERSION_CHECK_INTERVAL);
};

