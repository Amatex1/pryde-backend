import { useState, useRef, useEffect } from 'react';
import './AudioPlayer.css';

const AudioPlayer = ({ url, duration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setAudioDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * audioDuration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={url} preload="metadata" />
      
      <button className="play-pause-btn" onClick={togglePlayPause}>
        {isPlaying ? '⏸' : '▶'}
      </button>

      <div className="audio-info">
        <div className="audio-progress-bar" onClick={handleSeek}>
          <div className="audio-progress-fill" style={{ width: `${progress}%` }} />
          <div className="audio-progress-handle" style={{ left: `${progress}%` }} />
        </div>
        
        <div className="audio-time">
          <span className="current-time">{formatTime(currentTime)}</span>
          <span className="duration">{formatTime(audioDuration)}</span>
        </div>
      </div>

      <div className="audio-icon">🎤</div>
    </div>
  );
};

export default AudioPlayer;

