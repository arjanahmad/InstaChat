import React, { useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Activity,
  Maximize2,
  Volume2,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import DiagnosticsPanel from './DiagnosticsPanel';
import { useCall } from '../../context/CallContext';
import { CALL_STATUS, CALL_TYPE } from '../../services/callService';

export default function ActiveCallModal() {
  const {
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callDuration,
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const isVideo = activeCall?.type === CALL_TYPE.VIDEO;
  const isConnected = activeCall?.status === CALL_STATUS.CONNECTED;

  // Attach local media track
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideo]);

  // Attach remote media tracks
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && isVideo) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isVideo]);

  if (!activeCall) return null;

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 2000,
        background: 'rgba(3, 6, 16, 0.94)',
        padding: 0,
      }}
    >
      {/* Invisible Remote Audio Element for Audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Info Bar */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar name={activeCall.friendUsername} size={42} online={true} />
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                {activeCall.friendUsername}
              </h4>
              <span style={{ fontSize: '0.8rem', color: isConnected ? '#10b981' : 'var(--soft-cyan)' }}>
                {isConnected ? `Connected • ${formatDuration(callDuration)}` : 'Calling / Ringing...'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
              className="btn-icon"
              title="Toggle Call Diagnostics"
              style={{
                background: isDiagnosticsOpen ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                color: isDiagnosticsOpen ? '#00d2ff' : '#ffffff',
              }}
            >
              <Activity size={18} />
            </button>
          </div>
        </div>

        {/* Center Display: Video feeds or Voice visualizer */}
        <div
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            background: '#040711',
          }}
        >
          {isVideo ? (
            <>
              {/* Remote Video Feed */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: isConnected ? 'block' : 'none',
                }}
              />

              {!isConnected && (
                <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s ease' }}>
                  <Avatar name={activeCall.friendUsername} size={90} online={true} />
                  <div style={{ color: 'var(--soft-cyan)', marginTop: '16px', fontSize: '0.95rem', fontWeight: 600 }}>
                    Connecting video stream...
                  </div>
                </div>
              )}

              {/* Local PiP Video Preview */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '100px',
                  right: '24px',
                  width: '180px',
                  height: '120px',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
                  background: '#000000',
                  zIndex: 20,
                }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)', // Mirror front camera
                  }}
                />
              </div>
            </>
          ) : (
            /* Audio Call Visualizer */
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: -16,
                    borderRadius: '50%',
                    border: '2px solid rgba(0, 102, 255, 0.4)',
                    animation: isConnected ? 'pulseGlow 2s infinite' : 'ripple 1.5s infinite',
                  }}
                />
                <Avatar name={activeCall.friendUsername} size={110} online={true} />
              </div>

              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
                {activeCall.friendUsername}
              </h3>

              <div style={{ fontSize: '0.95rem', color: isConnected ? '#10b981' : 'var(--soft-cyan)' }}>
                {isConnected ? `In Call (${formatDuration(callDuration)})` : 'Ringing...'}
              </div>

              {/* Sound Bars Visualizer */}
              {isConnected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '30px', height: '36px' }}>
                  {[16, 26, 36, 20, 42, 28, 18, 38, 24, 46, 30, 20, 34, 16].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        height: `${h}px`,
                        background: 'linear-gradient(180deg, #00d2ff, #0066ff)',
                        borderRadius: 3,
                        animation: `pulseGlow ${0.5 + (i % 4) * 0.2}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            zIndex: 30,
          }}
        >
          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className="btn-icon"
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: isMuted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.12)',
              color: isMuted ? '#ef4444' : '#ffffff',
            }}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={endCall}
            className="btn-danger"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              padding: 0,
              boxShadow: '0 8px 25px rgba(239, 68, 68, 0.5)',
            }}
            title="End Call"
          >
            <PhoneOff size={28} />
          </button>

          {/* Camera Toggle Button (if video call) */}
          {isVideo && (
            <button
              type="button"
              onClick={toggleCamera}
              className="btn-icon"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: isCameraOff ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                color: isCameraOff ? '#ef4444' : '#ffffff',
              }}
              title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}
        </div>

        {/* Diagnostics Drawer */}
        <DiagnosticsPanel />
      </div>
    </div>
  );
}
