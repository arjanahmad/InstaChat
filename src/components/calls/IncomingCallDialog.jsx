import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useCall } from '../../context/CallContext';

export default function IncomingCallDialog() {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  const isVideo = incomingCall.type === 'VIDEO';

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 2500,
        background: 'rgba(5, 8, 20, 0.88)',
      }}
    >
      <div
        className="glass-panel-elevated modal-content"
        style={{
          padding: '36px 28px',
          maxWidth: '380px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 50px rgba(0, 102, 255, 0.4)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Pulsing Avatar */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
          <div
            style={{
              position: 'absolute',
              inset: -12,
              borderRadius: '50%',
              border: '2px solid rgba(0, 210, 255, 0.4)',
              animation: 'ripple 1.8s infinite',
            }}
          />
          <Avatar
            src={incomingCall.callerProfileImageUrl}
            name={incomingCall.callerUsername}
            size={80}
            online={true}
          />
        </div>

        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
          {incomingCall.callerUsername}
        </h3>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0, 102, 255, 0.15)',
            border: '1px solid rgba(0, 102, 255, 0.3)',
            color: 'var(--soft-cyan)',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '32px',
          }}
        >
          {isVideo ? <Video size={15} /> : <Phone size={15} />}
          <span>Incoming {isVideo ? 'Video' : 'Audio'} Call...</span>
        </div>

        {/* Action Buttons: Accept & Decline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={rejectCall}
              className="btn-danger"
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                padding: 0,
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
              }}
              title="Decline Call"
            >
              <PhoneOff size={26} />
            </button>
            <span style={{ fontSize: '0.78rem', color: '#fca5a5', fontWeight: 600 }}>Decline</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={acceptCall}
              className="btn-primary"
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                padding: 0,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                animation: 'pulseGlow 1.5s infinite',
              }}
              title="Accept Call"
            >
              <Phone size={26} />
            </button>
            <span style={{ fontSize: '0.78rem', color: '#6ee7b7', fontWeight: 600 }}>Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
