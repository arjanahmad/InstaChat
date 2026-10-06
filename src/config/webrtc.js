/**
 * WebRTC Configuration & Diagnostics for INSTAChat
 * Implements Multi-STUN and TURN relay traversal for cross-network connectivity.
 */

export const RTC_CONFIG = {
  iceServers: [
    // Public STUN Servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },

    // Metered OpenRelay Community TURN Servers for Cross-Network / Mobile Traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Diagnostics logger for WebRTC calls
 */
export class CallDiagnostics {
  constructor(onLog) {
    this.logs = [];
    this.onLog = onLog;
    this.candidateCounts = { local: 0, remote: 0, relayLocal: 0, relayRemote: 0 };
  }

  log(category, message, details = null) {
    const entry = {
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      category,
      message,
      details,
    };
    this.logs.push(entry);
    if (this.onLog) {
      this.onLog(entry, this.logs);
    }
    console.log(`[CallDiag:${category}]`, message, details || '');
  }

  recordLocalCandidate(candidate) {
    this.candidateCounts.local++;
    if (candidate?.candidate?.includes('typ relay')) {
      this.candidateCounts.relayLocal++;
      this.log('TURN_CANDIDATE', 'Discovered local TURN relay candidate (Cross-network ready)', candidate.candidate);
    } else {
      this.log('ICE_CANDIDATE', `Local candidate: ${candidate?.candidate?.slice(0, 45)}...`);
    }
  }

  recordRemoteCandidate(candidate) {
    this.candidateCounts.remote++;
    if (candidate?.sdp?.includes('typ relay')) {
      this.candidateCounts.relayRemote++;
      this.log('TURN_CANDIDATE', 'Received remote TURN relay candidate', candidate.sdp);
    } else {
      this.log('ICE_CANDIDATE', `Remote candidate received`);
    }
  }

  getSummary() {
    return {
      totalLogs: this.logs.length,
      candidateCounts: this.candidateCounts,
      turnUsed: this.candidateCounts.relayLocal > 0 || this.candidateCounts.relayRemote > 0,
      recentLogs: this.logs.slice(-15),
    };
  }
}

/**
 * Web Audio API Ringtone / Tone Generator
 * Produces clean telephone ringing and dial tones without external MP3 files.
 */
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.currentOscillators = [];
    this.intervalId = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Outgoing Ringing tone (US standard 440Hz + 480Hz, 2s on / 4s off)
   */
  startOutgoingRingtone() {
    this.stopTone();
    try {
      const playBurst = () => {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.8);
        osc2.stop(now + 1.8);
      };

      playBurst();
      this.intervalId = setInterval(playBurst, 4000);
    } catch (e) {
      console.warn('Outgoing ringtone error:', e);
    }
  }

  /**
   * Incoming Ringtone (Melodic double chime: 523Hz & 659Hz, repeats every 2.5s)
   */
  startIncomingRingtone() {
    this.stopTone();
    try {
      const playMelody = () => {
        const ctx = this.getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Chime 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Chime 2
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain2.gain.setValueAtTime(0.14, now + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.2);
        osc2.stop(now + 0.65);

        // Chime 3 (High chime)
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(1046.50, now + 0.4); // C6
        gain3.gain.setValueAtTime(0.16, now + 0.4);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(now + 0.4);
        osc3.stop(now + 0.9);
      };

      playMelody();
      this.intervalId = setInterval(playMelody, 2200);
    } catch (e) {
      console.warn('Incoming ringtone error:', e);
    }
  }

  /**
   * Short message received pip
   */
  playMessageSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch (_) {}
  }

  /**
   * Call ended tone (double beep)
   */
  playCallEndTone() {
    this.stopTone();
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(300, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  }

  stopTone() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const sounds = new SoundEngine();
