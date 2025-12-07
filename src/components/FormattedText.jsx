import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { convertEmojiShortcuts } from '../utils/textFormatting';
import './FormattedText.css';

const FormattedText = memo(function FormattedText({ text, className = '' }) {
  const navigate = useNavigate();

  if (!text) return null;

  // Convert emoji shortcuts
  const textWithEmojis = convertEmojiShortcuts(text);

  // Split text into parts (words and spaces)
  const parts = textWithEmojis.split(/(\s+)/);

  const handleMentionClick = async (username) => {
    try {
      // Navigate directly to the user's profile using their username
      navigate(`/profile/${username}`);
    } catch (error) {
      console.error('Error handling mention click:', error);
    }
  };

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check for hashtags
        if (part.match(/^#[\w]+$/)) {
          const tag = part.substring(1);
          return (
            <a
              key={index}
              href={`/hashtag/${tag}`}
              className="hashtag-link"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/hashtag/${tag}`);
              }}
            >
              {part}
            </a>
          );
        }

        // Check for mentions
        if (part.match(/^@[\w]+$/)) {
          const username = part.substring(1);
          return (
            <span
              key={index}
              className="mention-link"
              onClick={() => handleMentionClick(username)}
            >
              {part}
            </span>
          );
        }

        // Check for URLs
        if (part.match(/^https?:\/\/.+/)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="url-link"
            >
              {part}
            </a>
          );
        }

        // Regular text
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
});

export default FormattedText;

