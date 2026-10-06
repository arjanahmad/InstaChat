import React, { useState, useRef } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  X,
} from 'lucide-react';
import VoiceRecorder from './VoiceRecorder';

export default function MessageInput({
  onSendMessage,
  onSendMedia,
  onSendVoice,
  onTyping,
  uploadProgress,
  isUploading,
}) {
  const [text, setText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);

  const handleTextChange = (e) => {
    setText(e.target.value);
    if (onTyping) onTyping();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim() || isUploading) return;
    onSendMessage(text);
    setText('');
  };

  const handleFileSelected = (e, type) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMedia(file, type);
      setIsAttachOpen(false);
      e.target.value = ''; // Reset input
    }
  };

  if (isRecordingVoice) {
    return (
      <div style={{ padding: '12px 16px', background: 'var(--bg-surface)' }}>
        <VoiceRecorder
          onSendVoice={(blob, duration) => {
            onSendVoice(blob, duration);
            setIsRecordingVoice(false);
          }}
          onCancel={() => setIsRecordingVoice(false)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-glass)',
        position: 'relative',
      }}
    >
      {/* Upload Progress Bar */}
      {isUploading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${uploadProgress || 10}%`,
              background: 'linear-gradient(90deg, #0066ff, #00d2ff)',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      )}

      {/* Attachment Popover */}
      {isAttachOpen && (
        <div
          className="glass-panel-elevated"
          style={{
            position: 'absolute',
            bottom: '70px',
            left: '16px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 100,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              textAlign: 'left',
            }}
          >
            <ImageIcon size={18} color="#38bdf8" /> Photo (JPG, PNG, WEBP)
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              textAlign: 'left',
            }}
          >
            <Video size={18} color="#a855f7" /> Video (MP4, WEBM)
          </button>
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              textAlign: 'left',
            }}
          >
            <FileText size={18} color="#10b981" /> Document (PDF, DOC, ZIP)
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelected(e, 'IMAGE')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelected(e, 'VIDEO')}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.zip,.rar"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelected(e, 'DOCUMENT')}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Attachment button */}
        <button
          type="button"
          onClick={() => setIsAttachOpen(!isAttachOpen)}
          className="btn-icon"
          title="Share photo, video or document"
          style={{
            color: isAttachOpen ? 'var(--soft-cyan)' : 'var(--text-muted)',
            background: isAttachOpen ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          }}
        >
          {isAttachOpen ? <X size={18} /> : <Paperclip size={18} />}
        </button>

        {/* Text Input */}
        <input
          type="text"
          placeholder={isUploading ? 'Uploading media...' : 'Type a message...'}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={isUploading}
          className="input-field"
          style={{ flex: 1, padding: '12px 16px' }}
        />

        {/* Voice Note Button or Send Button */}
        {text.trim() ? (
          <button
            type="button"
            onClick={handleSend}
            disabled={isUploading}
            className="btn-primary"
            style={{ width: 44, height: 44, padding: 0, borderRadius: '50%' }}
            title="Send message"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsRecordingVoice(true)}
            disabled={isUploading}
            className="btn-icon"
            style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0, 102, 255, 0.15)', color: 'var(--soft-cyan)' }}
            title="Record voice note"
          >
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
