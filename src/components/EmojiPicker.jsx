import React, { useState } from 'react';
import './EmojiPicker.css';

const EmojiPicker = ({ onEmojiSelect, onClose }) => {
  const emojis = [
    '❤️', '😂', '😮', '😢', '😡', '👍', '👎', '🎉', '🔥', '💯',
    '😊', '😍', '🤔', '😎', '🙏', '👏', '💪', '✨', '⭐', '💜'
  ];

  return (
    <div className="emoji-picker-overlay" onClick={onClose}>
      <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
        <div className="emoji-picker-header">
          <h4>React with an emoji</h4>
          <button className="emoji-picker-close" onClick={onClose}>✕</button>
        </div>
        <div className="emoji-grid">
          {emojis.map((emoji, index) => (
            <button
              key={index}
              className="emoji-button"
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;

