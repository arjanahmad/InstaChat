import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send } from 'lucide-react';

export default function VoiceRecorder({ onSendVoice, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Microphone permission is required to record voice notes.');
      if (onCancel) onCancel();
    }
  };

  const stopAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);

      // Give a tiny moment for onstop to trigger
      setTimeout(() => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, {
            type: mediaRecorderRef.current?.mimeType || 'audio/webm',
          });
          onSendVoice(blob, Math.max(1, recordSeconds));
          cleanup();
        }
      }, 150);
    }
  };

  const cancelRecording = () => {
    cleanup();
    if (onCancel) onCancel();
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '8px 16px',
        background: 'rgba(239, 68, 68, 0.12)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#ef4444',
          animation: 'pulseGlow 1s infinite',
        }}
      />

      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f87171' }}>
        Recording {formatTime(recordSeconds)}
      </span>

      {/* Voice Wave Animation */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '3px', height: '24px' }}>
        {[14, 22, 10, 26, 18, 12, 28, 16, 20, 10, 24, 15].map((h, i) => (
          <div
            key={i}
            style={{
              width: 3,
              height: isRecording ? `${h}px` : '4px',
              backgroundColor: '#ef4444',
              borderRadius: 2,
              animation: isRecording ? `pulseGlow ${0.4 + (i % 5) * 0.15}s infinite alternate` : 'none',
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={cancelRecording}
        className="btn-icon"
        style={{ width: 34, height: 34, color: '#fca5a5' }}
        title="Cancel recording"
      >
        <Trash2 size={16} />
      </button>

      <button
        type="button"
        onClick={stopAndSend}
        className="btn-primary"
        style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', background: '#ef4444' }}
      >
        <Send size={15} /> Send
      </button>
    </div>
  );
}
