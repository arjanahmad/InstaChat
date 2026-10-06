import { describe, it, expect } from 'vitest';
import { RTC_CONFIG, CallDiagnostics } from '../config/webrtc';

describe('WebRTC & Relay Configuration', () => {
  it('includes multiple public STUN servers', () => {
    const stunServers = RTC_CONFIG.iceServers.filter((s) =>
      typeof s.urls === 'string' && s.urls.startsWith('stun:')
    );
    expect(stunServers.length).toBeGreaterThanOrEqual(4);
  });

  it('includes TURN servers with credentials for cross-network connectivity', () => {
    const turnServers = RTC_CONFIG.iceServers.filter(
      (s) => (typeof s.urls === 'string' && s.urls.startsWith('turn:')) || (typeof s.urls === 'string' && s.urls.startsWith('turns:'))
    );
    expect(turnServers.length).toBeGreaterThanOrEqual(3);
    expect(turnServers[0].username).toBe('openrelayproject');
    expect(turnServers[0].credential).toBe('openrelayproject');
  });

  it('records local and remote ICE and TURN candidates in CallDiagnostics', () => {
    const diag = new CallDiagnostics();

    diag.recordLocalCandidate({ candidate: 'candidate:1 1 UDP 2122252543 192.168.1.1 50000 typ host' });
    diag.recordLocalCandidate({ candidate: 'candidate:2 1 UDP 33562367 89.10.11.12 51000 typ relay raddr 0.0.0.0 rport 0' });

    const summary = diag.getSummary();
    expect(summary.candidateCounts.local).toBe(2);
    expect(summary.candidateCounts.relayLocal).toBe(1);
    expect(summary.turnUsed).toBe(true);
  });
});
