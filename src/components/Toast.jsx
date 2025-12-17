import { useEffect } from 'react';
import './Toast.css';

/**
 * Toast notification component with accessibility support
 *
 * Accessibility:
 * - aria-live="polite" for non-critical notifications (success, info)
 * - aria-live="assertive" for critical notifications (error, warning)
 * - role="status" or "alert" for screen reader announcements
 * - aria-atomic="true" to announce entire message
 */
function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      default:
        return '✅';
    }
  };

  // Determine ARIA attributes based on type
  const isUrgent = type === 'error' || type === 'warning';
  const ariaLive = isUrgent ? 'assertive' : 'polite';
  const role = isUrgent ? 'alert' : 'status';

  return (
    <div
      className={`toast toast-${type}`}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <span className="toast-icon" aria-hidden="true">{getIcon()}</span>
      <span className="toast-message">{message}</span>
      <button
        className="toast-close"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

export default Toast;

