import { useState } from 'react';
import axios from 'axios';
import './Poll.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const Poll = ({ poll, postId, currentUserId, onVote }) => {
  const [voting, setVoting] = useState(false);

  if (!poll || !poll.question) return null;

  const hasEnded = poll.endsAt && new Date(poll.endsAt) < new Date();
  const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
  
  // Check if current user has voted
  const userVotedIndex = poll.options.findIndex(opt => 
    opt.votes?.some(vote => vote === currentUserId || vote._id === currentUserId)
  );
  const hasVoted = userVotedIndex !== -1;

  const canSeeResults = hasVoted || poll.showResultsBeforeVoting || hasEnded;

  const handleVote = async (optionIndex) => {
    if (voting || hasEnded) return;

    setVoting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/posts/${postId}/poll/vote`,
        { optionIndex },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (onVote) {
        onVote(response.data);
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert(error.response?.data?.message || 'Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  const getPercentage = (votes) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const formatTimeRemaining = () => {
    if (!poll.endsAt) return null;
    
    const now = new Date();
    const end = new Date(poll.endsAt);
    const diff = end - now;

    if (diff <= 0) return 'Poll ended';

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  return (
    <div className="poll-container">
      <div className="poll-question">
        <span className="poll-icon">📊</span>
        <h4>{poll.question}</h4>
      </div>

      <div className="poll-options">
        {poll.options.map((option, index) => {
          const votes = option.votes?.length || 0;
          const percentage = getPercentage(votes);
          const isSelected = index === userVotedIndex;

          return (
            <div key={index} className="poll-option-wrapper">
              {canSeeResults ? (
                <div className={`poll-option-result ${isSelected ? 'selected' : ''}`}>
                  <div className="poll-option-bar" style={{ width: `${percentage}%` }} />
                  <div className="poll-option-content">
                    <span className="poll-option-text">{option.text}</span>
                    <span className="poll-option-percentage">{percentage}%</span>
                  </div>
                  {isSelected && <span className="voted-checkmark">✓</span>}
                </div>
              ) : (
                <button
                  className="poll-option-button"
                  onClick={() => handleVote(index)}
                  disabled={voting || hasEnded}
                >
                  {option.text}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="poll-footer">
        <span className="poll-votes">{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</span>
        {poll.endsAt && (
          <>
            <span className="poll-separator">•</span>
            <span className={`poll-time ${hasEnded ? 'ended' : ''}`}>
              {formatTimeRemaining()}
            </span>
          </>
        )}
        {poll.allowMultipleVotes && !hasEnded && (
          <>
            <span className="poll-separator">•</span>
            <span className="poll-info">Multiple votes allowed</span>
          </>
        )}
      </div>
    </div>
  );
};

export default Poll;

