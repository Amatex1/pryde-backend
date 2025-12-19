import { useState, useEffect } from 'react';
import { useAppReady } from '../state/appReady';
import './LoadingGate.css';

/**
 * LoadingGate - Prevents UI popping by ensuring critical resources load first
 * 
 * LOAD ORDER:
 * 1. Auth state (from App.jsx bootstrap)
 * 2. User data (if authenticated)
 * 3. Critical CSS/fonts
 * 4. Then show UI
 * 
 * This eliminates:
 * - Navbar popping in
 * - Sidebar appearing late
 * - Layout shifts
 * - Flash of unstyled content
 */
function LoadingGate({ children, requireAuth = false }) {
  const { ready, setReady } = useAppReady();
  const [loadingStage, setLoadingStage] = useState('auth');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadCriticalResources = async () => {
      try {
        // Stage 1: Wait for auth bootstrap (handled by App.jsx)
        setLoadingStage('auth');
        setProgress(25);
        
        // Small delay to ensure auth state is stable
        await new Promise(resolve => setTimeout(resolve, 100));

        // Stage 2: Wait for critical fonts to load
        setLoadingStage('fonts');
        setProgress(50);
        
        if (document.fonts) {
          await document.fonts.ready;
        }

        // Stage 3: Ensure CSS is loaded
        setLoadingStage('styles');
        setProgress(75);
        
        // Wait for stylesheets to load
        await Promise.all(
          Array.from(document.styleSheets).map(sheet => {
            try {
              // Access cssRules to ensure sheet is loaded
              return sheet.cssRules ? Promise.resolve() : Promise.reject();
            } catch (e) {
              // Cross-origin stylesheets will throw - that's ok
              return Promise.resolve();
            }
          })
        );

        // Stage 4: Ready!
        setLoadingStage('ready');
        setProgress(100);
        
        // Small delay for smooth transition
        await new Promise(resolve => setTimeout(resolve, 150));
        
        setReady(true);
      } catch (error) {
        console.warn('LoadingGate: Non-critical error during load:', error);
        // Don't block the app - show UI anyway
        setReady(true);
      }
    };

    if (!ready) {
      loadCriticalResources();
    }
  }, [ready, setReady]);

  if (!ready) {
    return (
      <div className="loading-gate">
        <div className="loading-gate-content">
          <div className="loading-gate-spinner"></div>
          <div className="loading-gate-progress">
            <div 
              className="loading-gate-progress-bar" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="loading-gate-text">
            {loadingStage === 'auth' && 'Checking authentication...'}
            {loadingStage === 'fonts' && 'Loading fonts...'}
            {loadingStage === 'styles' && 'Preparing interface...'}
            {loadingStage === 'ready' && 'Ready!'}
          </p>
        </div>
      </div>
    );
  }

  return children;
}

export default LoadingGate;

