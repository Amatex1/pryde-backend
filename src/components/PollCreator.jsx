import { useState } from 'react';
import './PollCreator.css';

const PollCreator = ({ onPollChange, initialPoll = null }) => {
  const [poll, setPoll] = useState(initialPoll || {
    question: '',
    options: ['', ''],
    endsAt: null,
    allowMultipleVotes: false,
    showResultsBeforeVoting: false
  });

  const updatePoll = (updates) => {
    const newPoll = { ...poll, ...updates };
    setPoll(newPoll);
    onPollChange(newPoll);
  };

  const addOption = () => {
    if (poll.options.length < 10) {
      updatePoll({ options: [...poll.options, ''] });
    }
  };

  const removeOption = (index) => {
    if (poll.options.length > 2) {
      const newOptions = poll.options.filter((_, i) => i !== index);
      updatePoll({ options: newOptions });
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...poll.options];
    newOptions[index] = value;
    updatePoll({ options: newOptions });
  };

  const setDuration = (hours) => {
    if (hours === 0) {
      updatePoll({ endsAt: null });
    } else {
      const endsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      updatePoll({ endsAt: endsAt.toISOString() });
    }
  };

  return (
    <div className="poll-creator">
      <div className="poll-header">
        <h4>📊 Create a Poll</h4>
      </div>

      <div className="poll-field">
        <label>Question</label>
        <input
          type="text"
          placeholder="Ask a question..."
          value={poll.question}
          onChange={(e) => updatePoll({ question: e.target.value })}
          maxLength={200}
        />
        <span className="char-count">{poll.question.length}/200</span>
      </div>

      <div className="poll-field">
        <label>Options</label>
        {poll.options.map((option, index) => (
          <div key={index} className="poll-option-input">
            <input
              type="text"
              placeholder={`Option ${index + 1}`}
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              maxLength={100}
            />
            {poll.options.length > 2 && (
              <button
                type="button"
                className="remove-option-btn"
                onClick={() => removeOption(index)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {poll.options.length < 10 && (
          <button type="button" className="add-option-btn" onClick={addOption}>
            + Add Option
          </button>
        )}
      </div>

      <div className="poll-field">
        <label>Poll Duration</label>
        <select
          value={poll.endsAt ? Math.round((new Date(poll.endsAt) - Date.now()) / 3600000) : 0}
          onChange={(e) => setDuration(parseInt(e.target.value))}
        >
          <option value={0}>No expiration</option>
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={24}>1 day</option>
          <option value={72}>3 days</option>
          <option value={168}>1 week</option>
        </select>
      </div>

      <div className="poll-settings">
        <label className="poll-checkbox">
          <input
            type="checkbox"
            checked={poll.allowMultipleVotes}
            onChange={(e) => updatePoll({ allowMultipleVotes: e.target.checked })}
          />
          <span>Allow multiple votes</span>
        </label>

        <label className="poll-checkbox">
          <input
            type="checkbox"
            checked={poll.showResultsBeforeVoting}
            onChange={(e) => updatePoll({ showResultsBeforeVoting: e.target.checked })}
          />
          <span>Show results before voting</span>
        </label>
      </div>
    </div>
  );
};

export default PollCreator;

