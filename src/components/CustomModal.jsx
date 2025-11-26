import { useState, useEffect } from 'react';
import './CustomModal.css';

/**
 * Custom Pryde-themed modal to replace JavaScript alert/confirm/prompt
 * 
 * Types:
 * - 'alert': Simple message with OK button
 * - 'confirm': Message with Cancel and Confirm buttons
 * - 'prompt': Message with text input and Cancel/Submit buttons
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

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue, isOpen]);

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
    <div className="custom-modal-overlay" onClick={handleCancel}>
      <div className="custom-modal-content" onClick={(e) => e.stopPropagation()}>
        {title && <h3 className="custom-modal-title">{title}</h3>}
        
        <div className="custom-modal-message">
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
          />
        )}

        <div className="custom-modal-actions">
          {type === 'alert' ? (
            <button 
              className="custom-modal-btn custom-modal-btn-primary" 
              onClick={handleConfirm}
              onKeyPress={handleKeyPress}
              autoFocus
            >
              OK
            </button>
          ) : (
            <>
              <button 
                className="custom-modal-btn custom-modal-btn-secondary" 
                onClick={handleCancel}
              >
                {cancelText}
              </button>
              <button 
                className="custom-modal-btn custom-modal-btn-primary" 
                onClick={handleConfirm}
                autoFocus
              >
                {confirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomModal;

