import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

export default function MediaModal({ mediaUrl, mediaType = 'image', onClose }) {
  if (!mediaUrl) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{ zIndex: 2000, background: 'rgba(0, 0, 0, 0.92)' }}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top controls */}
        <div
          style={{
            position: 'absolute',
            top: -46,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="btn-icon"
            style={{ width: 36, height: 36 }}
            title="Download full size"
          >
            <Download size={18} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{ width: 36, height: 36 }}
            title="Close viewer"
          >
            <X size={18} />
          </button>
        </div>

        {mediaType === 'image' && (
          <img
            src={mediaUrl}
            alt="Fullscreen view"
            style={{
              maxWidth: '100%',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
            }}
          />
        )}
      </div>
    </div>
  );
}
