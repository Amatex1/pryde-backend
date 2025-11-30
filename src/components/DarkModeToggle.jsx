import { useState, useEffect } from 'react';
import './DarkModeToggle.css';

function DarkModeToggle({ asIcon = false, onClick }) {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  useEffect(() => {
    // Apply theme to document
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Save preference
    localStorage.setItem('darkMode', isDark);
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark(!isDark);
    if (onClick) onClick();
  };

  // If used as icon only (in dropdown), just return the icon
  if (asIcon) {
    return <span className="dark-mode-icon">{isDark ? '☀️' : '🌙'}</span>;
  }

  return (
    <button
      className="dark-mode-toggle"
      onClick={toggleDarkMode}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}

export default DarkModeToggle;

