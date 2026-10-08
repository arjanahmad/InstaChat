import { RTC_CONFIG, CallDiagnostics, sounds } from '../config/webrtc';
import { realtimeSocket } from './realtimeSocket';

export const CALL_STATUS = {
  RINGING: 'RINGING',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ENDED: 'ENDED',
  REJECTED: 'REJECTED',
  BUSY: 'BUSY',
  FAILED: 'FAILED',
};

export const CALL_TYPE = {
  VOICE: 'VOICE',
  VIDEO: 'VIDEO',
};

/**
 * WebRTC Calling Manager
 * Implements full offer/answer handshake, ICE candidate queueing, STUN+TURN traversal,
 * two-way media stream management, and clean teardown.
 */
export class CallManager {
  constructor({ onCallStateChange, onRemoteStream, onLocalStream, onDiagnosticsUpdate }) {
    this.currentCallId = null;
    this.targetUserId = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isCaller = false;
    this.callType = CALL_TYPE.VOICE;
    this.diagnostics = new CallDiagnostics(onDiagnosticsUpdate);

    this.onCallStateChange = onCallStateChange;
    this.onRemoteStream = onRemoteStream;
    this.onLocalStream = onLocalStream;

    this.timeoutTimer = null;
    this.candidateQueue = []; // Queue ICE candidates arriving before remote description
    this.socketUnsubs = [];
  }

  /**
   * Initializes local user media (Microphone and optional Camera)
   */
  async acquireMedia(isVideo) {
    this.callType = isVideo ? CALL_TYPE.VIDEO : CALL_TYPE.VOICE;
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
    };

    try {
      this.diagnostics.log('MEDIA_REQUEST', `Requesting media: audio=true, video=${isVideo}`);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      if (this.onLocalStream) {
        this.onLocalStream(stream);
      }
      this.diagnostics.log('MEDIA_GRANTED', `Acquired ${stream.getTracks().length} local media tracks`);
      return stream;
    } catch (err) {
      this.diagnostics.log('MEDIA_ERROR', `Failed to access media devices: ${err.message}`);
      throw err;
    }
  }

  /**
   * Creates RTCPeerConnection instance with Multi-STUN & TURN
   */
  createPeerConnection() {
    this.diagnostics.log('PEER_INIT', 'Initializing RTCPeerConnection with STUN & TURN');
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    if (this.onRemoteStream) {
      this.onRemoteStream(this.remoteStream);
    }

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.diagnostics.log('TRACK_ADD', `Added local ${track.kind} track`);
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Remote track listener
    this.peerConnection.ontrack = (event) => {
      this.diagnostics.log('TRACK_RECEIVED', `Received remote ${event.track.kind} track`);
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream.getTracks().some((t) => t.id === track.id)) {
            this.remoteStream.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }

      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // ICE Candidate handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.diagnostics.recordLocalCandidate(event.candidate);
        realtimeSocket.emit('webrtc:ice-candidate', {
          callId: this.currentCallId,
          candidate: event.candidate,
          targetUserId: this.targetUserId,
          isCaller: this.isCaller,
        });
      } else {
        this.diagnostics.log('ICE_GATHER_COMPLETE', 'Local ICE candidate gathering completed');
      }
    };

    // ICE Connection State change
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.diagnostics.log('ICE_STATE_CHANGE', `ICE Connection State: ${state}`);
      if (state === 'connected' || state === 'completed') {
        sounds.stopTone();
        if (this.onCallStateChange) {
          this.onCallStateChange(CALL_STATUS.CONNECTED);
        }
      } else if (state === 'failed') {
        this.diagnostics.log('ICE_FAILED', 'ICE connection failed across networks.');
      }
    };

    // Overall Connection State change
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.diagnostics.log('CONN_STATE_CHANGE', `Connection State: ${state}`);
      if (state === 'connected') {
        sounds.stopTone();
        if (this.onCallStateChange) {
          this.onCallStateChange(CALL_STATUS.CONNECTED);
        }
      } else if (state === 'failed' || state === 'closed') {
        this.cleanup();
      }
    };
  }

  /**
   * Applies queued ICE candidates once remote description is set
   */
  async processCandidateQueue() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        this.diagnostics.recordRemoteCandidate(candidate);
      } catch (err) {
        this.diagnostics.log('CANDIDATE_QUEUE_ERR', `Failed to apply queued candidate: ${err.message}`);
      }
    }
  }

  /**
   * Handle incoming remote candidate (queue if remote desc not set)
   */
  async handleRemoteCandidate(candidate) {
    if (!candidate) return;

    if (!this.peerConnection || !this.peerConnection.remoteDescription) {
      this.diagnostics.log('CANDIDATE_QUEUED', 'Queuing ICE candidate until remote description is ready');
      this.candidateQueue.push(candidate);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      this.diagnostics.recordRemoteCandidate(candidate);
    } catch (err) {
      this.diagnostics.log('CANDIDATE_ADD_ERR', `Failed to add ICE candidate: ${err.message}`);
    }
  }

  /**
   * Start an outgoing call
   */
  async startCall({ caller, receiverId, receiverUsername, isVideo = false }) {
    this.isCaller = true;
    this.targetUserId = receiverId;
    this.currentCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.candidateQueue = [];

    sounds.startOutgoingRingtone();
    await this.acquireMedia(isVideo);
    this.createPeerConnection();

    // Setup socket listeners
    this.setupSignalingListeners();

    // Create SDP Offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    });
    await this.peerConnection.setLocalDescription(offer);
    this.diagnostics.log('OFFER_CREATED', 'SDP Offer created and set as local description');

    // Emit offer to receiver via socket
    realtimeSocket.emit('webrtc:call-offer', {
      callId: this.currentCallId,
      callerId: caller.userId,
      callerUsername: caller.username,
      receiverId,
      receiverUsername,
      type: isVideo ? CALL_TYPE.VIDEO : CALL_TYPE.VOICE,
      offerSdp: offer.sdp,
    });

    // Ring timeout (45 seconds)
    this.timeoutTimer = setTimeout(async () => {
      this.diagnostics.log('CALL_TIMEOUT', 'Call timed out (no answer from receiver)');
      await this.endCall();
    }, 45000);

    return this.currentCallId;
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callSession) {
    this.isCaller = false;
    this.targetUserId = callSession.callerId;
    this.currentCallId = callSession.callId;
    this.candidateQueue = [];
    const isVideo = callSession.type === CALL_TYPE.VIDEO;

    sounds.stopTone();
    await this.acquireMedia(isVideo);
    this.createPeerConnection();
    this.setupSignalingListeners();

    // Set remote offer
    this.diagnostics.log('SET_REMOTE_OFFER', 'Applying remote SDP offer description');
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: callSession.offerSdp })
    );

    // Process any candidates that arrived before offer was set
    await this.processCandidateQueue();

    // Create SDP Answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.diagnostics.log('ANSWER_CREATED', 'SDP Answer created and set as local description');

    // Emit answer to caller
    realtimeSocket.emit('webrtc:call-answer', {
      callId: this.currentCallId,
      callerId: callSession.callerId,
      receiverId: callSession.receiverId,
      answerSdp: answer.sdp,
    });

    if (this.onCallStateChange) {
      this.onCallStateChange(CALL_STATUS.CONNECTED);
    }
  }

  /**
   * Setup Realtime Socket listeners for signaling
   */
  setupSignalingListeners() {
    this.clearSignalingListeners();

    // Caller receives answer
    const unsubAnswer = realtimeSocket.on('webrtc:call-answered', async (data) => {
      if (data.callId === this.currentCallId && data.answerSdp) {
        sounds.stopTone();
        if (this.peerConnection && !this.peerConnection.currentRemoteDescription) {
          this.diagnostics.log('ANSWER_RECEIVED', 'Received SDP Answer from receiver');
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: data.answerSdp })
          );
          await this.processCandidateQueue();
          if (this.onCallStateChange) {
            this.onCallStateChange(CALL_STATUS.CONNECTED);
          }
        }
      }
    });
    this.socketUnsubs.push(unsubAnswer);

    // Call rejected by other party
    const unsubReject = realtimeSocket.on('webrtc:call-rejected', (data) => {
      if (data.callId === this.currentCallId) {
        this.diagnostics.log('CALL_REJECTED', 'Call was rejected by peer');
        sounds.playCallEndTone();
        this.cleanup();
        if (this.onCallStateChange) {
          this.onCallStateChange(CALL_STATUS.REJECTED);
        }
      }
    });
    this.socketUnsubs.push(unsubReject);

    // Call ended by other party
    const unsubEnded = realtimeSocket.on('webrtc:call-ended', (data) => {
      if (data.callId === this.currentCallId) {
        this.diagnostics.log('CALL_ENDED', 'Call was ended by peer');
        sounds.playCallEndTone();
        this.cleanup();
        if (this.onCallStateChange) {
          this.onCallStateChange(CALL_STATUS.ENDED);
        }
      }
    });
    this.socketUnsubs.push(unsubEnded);

    // Remote ICE Candidate received
    const unsubCandidate = realtimeSocket.on('webrtc:ice-candidate', async (data) => {
      if (data.callId === this.currentCallId && data.candidate) {
        await this.handleRemoteCandidate(data.candidate);
      }
    });
    this.socketUnsubs.push(unsubCandidate);
  }

  clearSignalingListeners() {
    this.socketUnsubs.forEach((unsub) => {
      try {
        unsub();
      } catch (_) {}
    });
    this.socketUnsubs = [];
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId, callerId) {
    sounds.stopTone();
    sounds.playCallEndTone();
    const peerId = callerId || this.targetUserId;
    if (peerId) {
      realtimeSocket.emit('webrtc:call-rejected', {
        callId,
        callerId: peerId,
        targetUserId: peerId,
        otherUserId: peerId,
      });
      realtimeSocket.emit('webrtc:call-hangup', {
        callId,
        otherUserId: peerId,
        targetUserId: peerId,
      });
    }
    this.cleanup();
  }

  /**
   * End current call
   */
  async endCall() {
    sounds.stopTone();
    sounds.playCallEndTone();
    if (this.currentCallId && this.targetUserId) {
      realtimeSocket.emit('webrtc:call-hangup', {
        callId: this.currentCallId,
        otherUserId: this.targetUserId,
        targetUserId: this.targetUserId,
      });
      realtimeSocket.emit('webrtc:call-end', {
        callId: this.currentCallId,
        targetUserId: this.targetUserId,
        otherUserId: this.targetUserId,
      });
    }
    this.cleanup();
    if (this.onCallStateChange) {
      this.onCallStateChange(CALL_STATUS.ENDED);
    }
  }

  /**
   * Toggle Microphone mute
   */
  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const isMuted = !audioTrack.enabled;
        this.diagnostics.log('MUTE_TOGGLED', `Microphone mute state: ${isMuted}`);
        return isMuted;
      }
    }
    return false;
  }

  /**
   * Toggle Camera video on/off
   */
  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const isCameraOff = !videoTrack.enabled;
        this.diagnostics.log('CAMERA_TOGGLED', `Camera off state: ${isCameraOff}`);
        return isCameraOff;
      }
    }
    return false;
  }

  /**
   * Full cleanup of media tracks, connections, timers, and listeners
   */
  cleanup() {
    sounds.stopTone();
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.clearSignalingListeners();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
    this.currentCallId = null;
    this.targetUserId = null;
    this.candidateQueue = [];
  }
}

/**
 * Listens for incoming calls to the user in real time
 */
export function subscribeToIncomingCalls(userId, callback) {
  if (!userId) return () => {};

  return realtimeSocket.on('webrtc:incoming-call', (callData) => {
    if (callData.receiverId === userId) {
      callback([callData]);
    }
  });
}
