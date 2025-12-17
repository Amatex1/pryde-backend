import { useState, useEffect, useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import './CustomModal.css';

/**
 * Custom Pryde-themed modal to replace JavaScript alert/confirm/prompt
 *
 * Types:
 * - 'alert': Simple message with OK button
 * - 'confirm': Message with Cancel and Confirm buttons
 * - 'prompt': Message with text input and Cancel/Submit buttons
 *
 * Accessibility:
 * - Focus trap keeps keyboard navigation within modal
 * - ARIA attributes for screen readers
 * - Escape key closes modal
 * - Focus returns to trigger element on close
 */
function CustomModal({
  isOpen,
  onClose,
  type = 'alert',
  title = '',
  message = '',
  placeholder = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm = null,
  inputType = 'text',
  defaultValue = ''
}) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const triggerRef = useRef(null);

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue, isOpen]);

  // Store trigger element and handle focus return
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current) {
      triggerRef.current.focus();
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm?.(inputValue);
    } else {
      onConfirm?.();
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && type !== 'prompt') {
      handleConfirm();
    }
  };

  return (
    <FocusTrap
      active={isOpen}
      focusTrapOptions={{
        initialFocus: false,
        allowOutsideClick: true,
        escapeDeactivates: false, // We handle Escape manually
        returnFocusOnDeactivate: true
      }}
    >
      <div
        className="custom-modal-overlay"
        onClick={handleCancel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        aria-describedby="modal-message"
      >
        <div className="custom-modal-content" onClick={(e) => e.stopPropagation()}>
          {title && <h3 id="modal-title" className="custom-modal-title">{title}</h3>}

          <div id="modal-message" className="custom-modal-message">
            {message}
          </div>

          {type === 'prompt' && (
            <input
              type={inputType}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="custom-modal-input"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleConfirm()}
              aria-label={placeholder || 'Input field'}
              aria-required="true"
            />
          )}

          <div className="custom-modal-actions">
            {type === 'alert' ? (
              <button
                className="custom-modal-btn custom-modal-btn-primary"
                onClick={handleConfirm}
                onKeyPress={handleKeyPress}
                autoFocus
                aria-label="Close dialog"
              >
                OK
              </button>
            ) : (
              <>
                <button
                  className="custom-modal-btn custom-modal-btn-secondary"
                  onClick={handleCancel}
                  aria-label={`Cancel ${type === 'confirm' ? 'action' : 'input'}`}
                >
                  {cancelText}
                </button>
                <button
                  className="custom-modal-btn custom-modal-btn-primary"
                  onClick={handleConfirm}
                  autoFocus
                  aria-label={`${confirmText} ${type === 'confirm' ? 'action' : 'and submit'}`}
                >
                  {confirmText}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}

export default CustomModal;

