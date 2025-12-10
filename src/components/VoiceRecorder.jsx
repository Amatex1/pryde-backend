import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './VoiceRecorder.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const VoiceRecorder = ({ onRecordingComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadVoiceNote(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setDuration(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (onCancel) onCancel();
  };

  const uploadVoiceNote = async (blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'voice-note.webm');
      formData.append('duration', duration);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/upload/voice-note`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (onRecordingComplete) {
        onRecordingComplete({
          url: response.data.url,
          duration: duration
        });
      }
    } catch (error) {
      console.error('Error uploading voice note:', error);
      alert('Failed to upload voice note');
    } finally {
      setUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (uploading) {
    return (
      <div className="voice-recorder uploading">
        <div className="uploading-spinner"></div>
        <span>Uploading voice note...</span>
      </div>
    );
  }

  if (!isRecording) {
    return (
      <button className="start-recording-btn" onClick={startRecording}>
        🎤 Record Voice Note
      </button>
    );
  }

  return (
    <div className="voice-recorder recording">
      <div className="recording-indicator">
        <span className={`recording-dot ${isPaused ? 'paused' : ''}`}></span>
        <span className="recording-text">{isPaused ? 'Paused' : 'Recording'}</span>
      </div>
      <div className="recording-duration">{formatDuration(duration)}</div>
      <div className="recording-controls">
        {!isPaused ? (
          <button className="pause-btn" onClick={pauseRecording}>⏸</button>
        ) : (
          <button className="resume-btn" onClick={resumeRecording}>▶</button>
        )}
        <button className="stop-btn" onClick={stopRecording}>⏹ Send</button>
        <button className="cancel-btn" onClick={cancelRecording}>✕</button>
      </div>
    </div>
  );
};

export default VoiceRecorder;

