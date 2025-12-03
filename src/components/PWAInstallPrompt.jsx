import { useState, useEffect } from 'react';
import { promptInstall, isPWA } from '../utils/pwa';
import './PWAInstallPrompt.css';

function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isPWA() || dismissed) {
      return;
    }

    // Check if user has dismissed before
    const hasDissmissed = localStorage.getItem('pwa-install-dismissed');
    if (hasDissmissed) {
      setDismissed(true);
      return;
    }

    // Listen for install availability
    const handleInstallAvailable = () => {
      setShowPrompt(true);
    };

    const handleInstallCompleted = () => {
      setShowPrompt(false);
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-install-completed', handleInstallCompleted);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-install-completed', handleInstallCompleted);
    };
  }, [dismissed]);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-prompt">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <img src="/pryde-logo.png" alt="Pryde Social" />
        </div>
        <div className="pwa-install-text">
          <h3>Install Pryde Social</h3>
          <p>Get the full app experience! Install Pryde Social on your device for faster access and offline support.</p>
        </div>
        <div className="pwa-install-actions">
          <button onClick={handleInstall} className="pwa-install-btn">
            Install App
          </button>
          <button onClick={handleDismiss} className="pwa-dismiss-btn">
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;

