import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { RTC_CONFIG, CallDiagnostics, sounds } from '../config/webrtc';

export const CALL_STATUS = {
  RINGING: 'RINGING',
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
 */
export class CallManager {
  constructor({ onCallStateChange, onRemoteStream, onLocalStream, onDiagnosticsUpdate }) {
    this.currentCallId = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isCaller = false;
    this.callType = CALL_TYPE.VOICE;
    this.diagnostics = new CallDiagnostics(onDiagnosticsUpdate);

    this.onCallStateChange = onCallStateChange;
    this.onRemoteStream = onRemoteStream;
    this.onLocalStream = onLocalStream;

    this.callDocUnsub = null;
    this.candidatesUnsub = null;
    this.timeoutTimer = null;
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
      this.diagnostics.log('MEDIA_REQUEST', `Requesting media with constraints: audio=true, video=${isVideo}`);
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
   * Creates the RTCPeerConnection instance with STUN & TURN
   */
  createPeerConnection() {
    this.diagnostics.log('PEER_INIT', 'Initializing RTCPeerConnection with STUN & TURN servers');
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    if (this.onRemoteStream) {
      this.onRemoteStream(this.remoteStream);
    }

    // Add local stream tracks to connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.diagnostics.log('TRACK_ADD', `Added local ${track.kind} track`);
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Listen for remote tracks
    this.peerConnection.ontrack = (event) => {
      this.diagnostics.log('TRACK_RECEIVED', `Received remote ${event.track.kind} track`);
      event.streams[0]?.getTracks().forEach((track) => {
        if (!this.remoteStream.getTracks().find((t) => t.id === track.id)) {
          this.remoteStream.addTrack(track);
        }
      });
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // ICE Candidate handler
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.diagnostics.recordLocalCandidate(event.candidate);
        this.sendIceCandidate(event.candidate);
      } else {
        this.diagnostics.log('ICE_GATHER_COMPLETE', 'All local ICE candidates have been gathered');
      }
    };

    // ICE Connection State Change
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.diagnostics.log('ICE_STATE_CHANGE', `ICE Connection State: ${state}`);
      if (state === 'connected' || state === 'completed') {
        sounds.stopTone();
      } else if (state === 'failed') {
        this.diagnostics.log('ICE_FAILED', 'ICE connection failed. TURN server relay may be required or blocked.');
      }
    };

    // Overall PeerConnection State Change
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
   * Sends local ICE candidate to Firestore subcollection
   */
  async sendIceCandidate(candidate) {
    if (!this.currentCallId) return;
    try {
      const candidateCol = collection(db, 'calls', this.currentCallId, 'candidates');
      await addDoc(candidateCol, {
        sdp: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        isCaller: this.isCaller,
        caller: this.isCaller,
        timestamp: Date.now(),
      });
    } catch (err) {
      this.diagnostics.log('CANDIDATE_SEND_ERR', `Failed to send candidate: ${err.message}`);
    }
  }

  /**
   * Listen to remote candidates from Firestore
   */
  listenToRemoteCandidates() {
    if (!this.currentCallId) return;
    const candidatesCol = collection(db, 'calls', this.currentCallId, 'candidates');
    const targetIsCaller = !this.isCaller;

    this.candidatesUnsub = onSnapshot(candidatesCol, (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const candIsCaller = data.isCaller ?? data.caller ?? false;

          if (candIsCaller === targetIsCaller && data.sdp) {
            try {
              this.diagnostics.recordRemoteCandidate(data);
              await this.peerConnection.addIceCandidate(
                new RTCIceCandidate({
                  candidate: data.sdp,
                  sdpMid: data.sdpMid,
                  sdpMLineIndex: data.sdpMLineIndex,
                })
              );
            } catch (e) {
              this.diagnostics.log('CANDIDATE_ADD_ERR', `Error applying candidate: ${e.message}`);
            }
          }
        }
      });
    });
  }

  /**
   * Start an outgoing call
   */
  async startCall({ caller, receiverId, receiverUsername, isVideo = false }) {
    this.isCaller = true;
    this.currentCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    sounds.startOutgoingRingtone();
    await this.acquireMedia(isVideo);
    this.createPeerConnection();

    // Create SDP Offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideo,
    });
    await this.peerConnection.setLocalDescription(offer);
    this.diagnostics.log('OFFER_CREATED', 'SDP Offer generated and set as local description');

    // Create Call document in Firestore
    const callData = {
      callId: this.currentCallId,
      callerId: caller.userId,
      callerUsername: caller.username,
      receiverId,
      receiverUsername,
      type: isVideo ? CALL_TYPE.VIDEO : CALL_TYPE.VOICE,
      status: CALL_STATUS.RINGING,
      offerSdp: offer.sdp,
      answerSdp: null,
      isCallerMuted: false,
      isReceiverMuted: false,
      isCallerVideoEnabled: isVideo,
      isReceiverVideoEnabled: isVideo,
      createdAt: Date.now(),
      connectedAt: null,
      endedAt: null,
    };

    await setDoc(doc(db, 'calls', this.currentCallId), callData);
    this.listenToRemoteCandidates();

    // Listen to call document for Answer or status change
    this.callDocUnsub = onSnapshot(doc(db, 'calls', this.currentCallId), async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status === CALL_STATUS.CONNECTED && data.answerSdp && !this.peerConnection.currentRemoteDescription) {
        this.diagnostics.log('ANSWER_RECEIVED', 'Received SDP Answer from receiver');
        sounds.stopTone();
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: data.answerSdp })
        );
        if (this.onCallStateChange) {
          this.onCallStateChange(CALL_STATUS.CONNECTED);
        }
      } else if (data.status === CALL_STATUS.REJECTED || data.status === CALL_STATUS.ENDED || data.status === CALL_STATUS.BUSY) {
        this.diagnostics.log('CALL_TERMINATED', `Call status changed to: ${data.status}`);
        sounds.playCallEndTone();
        this.cleanup();
        if (this.onCallStateChange) {
          this.onCallStateChange(data.status);
        }
      }
    });

    // 45s Ring Timeout
    this.timeoutTimer = setTimeout(async () => {
      const snap = await getDoc(doc(db, 'calls', this.currentCallId));
      if (snap.exists() && snap.data().status === CALL_STATUS.RINGING) {
        this.diagnostics.log('CALL_TIMEOUT', 'Call timed out with no answer');
        await this.endCall();
      }
    }, 45000);

    return this.currentCallId;
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callSession) {
    this.isCaller = false;
    this.currentCallId = callSession.callId;
    const isVideo = callSession.type === CALL_TYPE.VIDEO;

    sounds.stopTone();
    await this.acquireMedia(isVideo);
    this.createPeerConnection();

    // Set remote offer description
    this.diagnostics.log('SET_REMOTE_OFFER', 'Setting remote offer description');
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: callSession.offerSdp })
    );

    // Create SDP Answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.diagnostics.log('ANSWER_CREATED', 'SDP Answer generated and set as local description');

    // Update Call document
    await updateDoc(doc(db, 'calls', this.currentCallId), {
      answerSdp: answer.sdp,
      status: CALL_STATUS.CONNECTED,
      connectedAt: Date.now(),
    });

    this.listenToRemoteCandidates();

    // Listen to call document for termination
    this.callDocUnsub = onSnapshot(doc(db, 'calls', this.currentCallId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.status === CALL_STATUS.ENDED || data.status === CALL_STATUS.REJECTED) {
        sounds.playCallEndTone();
        this.cleanup();
        if (this.onCallStateChange) {
          this.onCallStateChange(data.status);
        }
      }
    });

    if (this.onCallStateChange) {
      this.onCallStateChange(CALL_STATUS.CONNECTED);
    }
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(callId) {
    sounds.stopTone();
    sounds.playCallEndTone();
    try {
      await updateDoc(doc(db, 'calls', callId), {
        status: CALL_STATUS.REJECTED,
        endedAt: Date.now(),
      });
    } catch (_) {}
    this.cleanup();
  }

  /**
   * End current call
   */
  async endCall() {
    sounds.stopTone();
    sounds.playCallEndTone();
    if (this.currentCallId) {
      try {
        await updateDoc(doc(db, 'calls', this.currentCallId), {
          status: CALL_STATUS.ENDED,
          endedAt: Date.now(),
        });
      } catch (_) {}
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
        this.diagnostics.log('MUTE_TOGGLED', `Microphone muted: ${isMuted}`);
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
        this.diagnostics.log('CAMERA_TOGGLED', `Camera disabled: ${isCameraOff}`);
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
    if (this.callDocUnsub) {
      this.callDocUnsub();
      this.callDocUnsub = null;
    }
    if (this.candidatesUnsub) {
      this.candidatesUnsub();
      this.candidatesUnsub = null;
    }

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
  }
}

/**
 * Listens for incoming calls to the user
 */
export function subscribeToIncomingCalls(userId, callback) {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'calls'),
    where('receiverId', '==', userId),
    where('status', '==', CALL_STATUS.RINGING)
  );

  return onSnapshot(q, (snap) => {
    const now = Date.now();
    const calls = snap.docs
      .map((d) => d.data())
      .filter((c) => now - (c.createdAt || 0) < 45000); // 45 seconds validity
    callback(calls);
  });
}
