import { useEffect } from 'react';

/**
 * Wrapper component for legal pages that applies the user's dark mode preference
 * This ensures legal pages respect the theme even when viewed by logged-out users
 */
function LegalPageWrapper({ children }) {
  useEffect(() => {
    // Check localStorage for saved dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedDarkMode === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  return <>{children}</>;
}

export default LegalPageWrapper;

