import { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import './PhotoRepositionModal.css';

function PhotoRepositionModal({ isOpen, onClose, photoUrl, photoType, currentPosition, onUpdate }) {
  const [position, setPosition] = useState(currentPosition || { x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (currentPosition) {
      setPosition(currentPosition);
    }
  }, [currentPosition]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    updatePosition(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      updatePosition(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    updatePosition(e.touches[0]);
  };

  const handleTouchMove = (e) => {
    if (isDragging) {
      e.preventDefault();
      updatePosition(e.touches[0]);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const updatePosition = (e) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/users/photo-position', {
        type: photoType,
        x: position.x,
        y: position.y
      });
      onUpdate(position);
      onClose();
    } catch (error) {
      console.error('Failed to save photo position:', error);
      alert('Failed to save position. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPosition({ x: 50, y: 50 });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="photo-reposition-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reposition-header">
          <h2>Reposition {photoType === 'profile' ? 'Profile' : 'Cover'} Photo</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="reposition-instructions">
          Click and drag to reposition your photo. The highlighted frame shows what will be visible on your profile.
        </div>

        <div
          ref={containerRef}
          className="reposition-container"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            ref={imageRef}
            src={getImageUrl(photoUrl)}
            alt={photoType}
            className="reposition-image"
            style={{
              objectPosition: `${position.x}% ${position.y}%`
            }}
            draggable={false}
          />

          {/* Visible area frame - shows what will be displayed */}
          <div className={`visible-area-frame ${photoType === 'profile' ? 'profile-frame' : 'cover-frame'}`}>
            <div className="frame-overlay frame-overlay-top"></div>
            <div className="frame-overlay frame-overlay-bottom"></div>
            <div className="frame-overlay frame-overlay-left"></div>
            <div className="frame-overlay frame-overlay-right"></div>
            <div className="frame-border"></div>
          </div>

          <div
            className="position-marker"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`
            }}
          />
        </div>

        <div className="reposition-footer">
          <button className="btn-reset" onClick={handleReset}>
            Reset to Center
          </button>
          <div className="footer-actions">
            <button className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Position'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhotoRepositionModal;

