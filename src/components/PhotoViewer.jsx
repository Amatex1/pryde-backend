import { useEffect } from 'react';
import './PhotoViewer.css';

function PhotoViewer({ imageUrl, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when viewer is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="photo-viewer-overlay" onClick={onClose}>
      <div className="photo-viewer-container">
        <button className="photo-viewer-close" onClick={onClose}>
          ✕
        </button>
        <img 
          src={imageUrl} 
          alt="Full size" 
          className="photo-viewer-image"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

export default PhotoViewer;

