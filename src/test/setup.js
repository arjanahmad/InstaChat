// Test Setup for INSTAChat Web
import { vi } from 'vitest';

// Mock Web Audio API
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }
  resume() {
    return Promise.resolve();
  }
}

global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.iceConnectionState = 'new';
    this.connectionState = 'new';
    this.localDescription = null;
    this.remoteDescription = null;
    this.ontrack = null;
    this.onicecandidate = null;
    this.oniceconnectionstatechange = null;
    this.onconnectionstatechange = null;
  }
  createOffer() {
    return Promise.resolve({ type: 'offer', sdp: 'v=0\r\no=mockOffer\r\ns=-\r\nt=0 0\r\n' });
  }
  createAnswer() {
    return Promise.resolve({ type: 'answer', sdp: 'v=0\r\no=mockAnswer\r\ns=-\r\nt=0 0\r\n' });
  }
  setLocalDescription(desc) {
    this.localDescription = desc;
    return Promise.resolve();
  }
  setRemoteDescription(desc) {
    this.remoteDescription = desc;
    return Promise.resolve();
  }
  addTrack(track, stream) {
    return { track };
  }
  addIceCandidate(cand) {
    return Promise.resolve();
  }
  close() {
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
  }
}

global.RTCPeerConnection = MockRTCPeerConnection;
global.RTCSessionDescription = class {
  constructor(init) {
    this.type = init.type;
    this.sdp = init.sdp;
  }
};
global.RTCIceCandidate = class {
  constructor(init) {
    this.candidate = init.candidate;
    this.sdpMid = init.sdpMid;
    this.sdpMLineIndex = init.sdpMLineIndex;
  }
};
