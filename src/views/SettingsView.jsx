import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mic,
  Video,
  Volume2,
  LogOut,
  ShieldCheck,
  Info,
  CheckCircle2,
  Cloud,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { sounds } from '../config/webrtc';

export default function SettingsView() {
  const { currentUser, logout } = useAuth();
  const [notifPerm, setNotifPerm] = useState(notificationService.permission);
  const [testingSound, setTestingSound] = useState(false);

  const requestNotif = async () => {
    const granted = await notificationService.requestPermission();
    setNotifPerm(granted ? 'granted' : 'denied');
  };

  const testRingtone = () => {
    if (testingSound) {
      sounds.stopTone();
      setTestingSound(false);
    } else {
      sounds.startIncomingRingtone();
      setTestingSound(true);
      setTimeout(() => {
        sounds.stopTone();
        setTestingSound(false);
      }, 5000);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        padding: '24px',
        background: 'var(--bg-primary)',
      }}
    >
      <div style={{ maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Settings & Hardware
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            System permissions, audio diagnostics, and application preferences.
          </p>
        </div>

        {/* Browser Notifications Card */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'rgba(0, 102, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bell size={20} color="#00d2ff" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Desktop / Browser Notifications
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                  Status: <strong>{notifPerm}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={requestNotif}
              disabled={notifPerm === 'granted'}
              className={notifPerm === 'granted' ? 'btn-secondary' : 'btn-primary'}
              style={{ fontSize: '0.84rem' }}
            >
              {notifPerm === 'granted' ? 'Enabled' : 'Allow Notifications'}
            </button>
          </div>
        </div>

        {/* Audio Engine Testing */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Volume2 size={20} color="#10b981" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                  Web Audio Ringtone Generator
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                  Synthesizes harmonic telephone chimes for incoming calls
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={testRingtone}
              className="btn-secondary"
              style={{ fontSize: '0.84rem' }}
            >
              {testingSound ? 'Stop Chime' : 'Test Sound'}
            </button>
          </div>
        </div>

        {/* Cloud & WebRTC Network Relay Status */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={18} color="#00d2ff" /> Cloud Infrastructure Status
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Firebase Firestore & Auth</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Active (battlechat-5329e)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cloudinary Media Storage</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Active (jdkg4l75 / battlechat_upload)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>WebRTC STUN Servers</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Google, Twilio & Mozilla (7 nodes)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>WebRTC TURN Relays</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Metered OpenRelay (Ports 80 & 443 TCP/UDP)</span>
            </div>
          </div>
        </div>

        {/* Log Out */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                Sign Out
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: '2px 0 0 0' }}>
                End session on this device.
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="btn-danger"
              style={{ fontSize: '0.85rem' }}
            >
              <LogOut size={16} /> Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
