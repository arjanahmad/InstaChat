import React, { useState, useRef } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Play,
  Pause,
  FileText,
  Download,
} from 'lucide-react';

export default function MessageBubble({ message, isOwn, onMediaClick }) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const renderStatus = () => {
    if (!isOwn) return null;

    const status = message.status || (message.isRead ? 'READ' : 'SENT');
    if (status === 'SENDING') {
      return <Clock size={13} color="#94a3b8" title="Sending..." />;
    } else if (status === 'SENT') {
      return <Check size={14} color="#94a3b8" title="Sent" />;
    } else if (status === 'DELIVERED') {
      return <CheckCheck size={15} color="#94a3b8" title="Delivered" />;
    } else if (status === 'READ') {
      return <CheckCheck size={15} color="#00d2ff" title="Read" />;
    }
    return <Check size={14} color="#94a3b8" />;
  };

  const type = message.messageType || 'TEXT';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
        maxWidth: '100%',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          maxWidth: '75%',
          padding: type === 'IMAGE' || type === 'VIDEO' ? '6px' : '10px 14px',
          borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isOwn
            ? 'linear-gradient(135deg, #005ce6 0%, #0066ff 100%)'
            : 'rgba(15, 28, 63, 0.85)',
          border: isOwn
            ? '1px solid rgba(0, 210, 255, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isOwn
            ? '0 4px 15px rgba(0, 102, 255, 0.25)'
            : '0 2px 10px rgba(0, 0, 0, 0.2)',
          color: '#ffffff',
          position: 'relative',
          wordBreak: 'break-word',
        }}
      >
        {/* TEXT MESSAGE */}
        {type === 'TEXT' && (
          <p style={{ fontSize: '0.94rem', lineHeight: '1.45', margin: 0 }}>
            {message.text}
          </p>
        )}

        {/* IMAGE MESSAGE */}
        {type === 'IMAGE' && message.imageUrl && (
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
            <img
              src={message.imageUrl}
              alt="Shared image"
              onClick={() => onMediaClick && onMediaClick(message.imageUrl, 'image')}
              style={{
                width: '100%',
                maxHeight: '340px',
                objectFit: 'cover',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'block',
              }}
              loading="lazy"
            />
          </div>
        )}

        {/* VIDEO MESSAGE */}
        {type === 'VIDEO' && message.videoUrl && (
          <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
            <video
              src={message.videoUrl}
              controls
              playsInline
              style={{
                width: '100%',
                maxHeight: '340px',
                borderRadius: '12px',
                display: 'block',
                background: '#000000',
              }}
            />
          </div>
        )}

        {/* VOICE NOTE MESSAGE */}
        {type === 'VOICE' && (message.voiceUrl || message.voiceBase64) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', padding: '4px 2px' }}>
            <audio
              ref={audioRef}
              src={message.voiceUrl || message.voiceBase64}
              onEnded={() => setIsPlayingAudio(false)}
              onError={(e) => console.warn('Audio play error:', e)}
            />
            <button
              type="button"
              onClick={toggleAudio}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: isOwn ? '#ffffff' : 'var(--primary-blue)',
                color: isOwn ? 'var(--primary-blue)' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              {isPlayingAudio ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '18px' }}>
                {[12, 18, 24, 14, 28, 20, 16, 26, 10, 22, 18, 14, 20, 8].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: 2.5,
                      height: `${h * 0.7}px`,
                      backgroundColor: isPlayingAudio ? '#00d2ff' : 'rgba(255, 255, 255, 0.6)',
                      borderRadius: 2,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                {message.voiceDurationSeconds ? `${message.voiceDurationSeconds}s` : 'Voice note'}
              </span>
            </div>
          </div>
        )}

        {/* DOCUMENT MESSAGE */}
        {type === 'DOCUMENT' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px', padding: '4px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} color="#00d2ff" />
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {message.documentName || 'Document'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                {formatBytes(message.documentSize)}
              </div>
            </div>
            {message.documentUrl && (
              <a
                href={message.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={message.documentName || true}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
                title="Download file"
              >
                <Download size={16} />
              </a>
            )}
          </div>
        )}

        {/* Message Metadata (Timestamp + Status) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
            marginTop: '4px',
            fontSize: '0.68rem',
            color: 'rgba(255, 255, 255, 0.65)',
            userSelect: 'none',
          }}
        >
          <span>{formatTimestamp(message.timestamp)}</span>
          {renderStatus()}
        </div>
      </div>
    </div>
  );
}
