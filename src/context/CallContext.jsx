import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { CallManager, CALL_STATUS, CALL_TYPE, subscribeToIncomingCalls } from '../services/callService';
import { notificationService } from '../services/notificationService';
import { sounds } from '../config/webrtc';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const { currentUser } = useAuth();
  const [activeCall, setActiveCall] = useState(null); // { callId, friendId, friendUsername, type, status, isCaller }
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [diagnosticsLogs, setDiagnosticsLogs] = useState([]);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const callManagerRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize CallManager instance
  useEffect(() => {
    callManagerRef.current = new CallManager({
      onCallStateChange: (newStatus) => {
        setActiveCall((prev) => (prev ? { ...prev, status: newStatus } : null));

        if (newStatus === CALL_STATUS.CONNECTED) {
          // Start call duration timer
          if (!timerRef.current) {
            setCallDuration(0);
            timerRef.current = setInterval(() => {
              setCallDuration((c) => c + 1);
            }, 1000);
          }
        } else if (newStatus === CALL_STATUS.ENDED || newStatus === CALL_STATUS.REJECTED || newStatus === CALL_STATUS.FAILED) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setTimeout(() => {
            setActiveCall(null);
            setLocalStream(null);
            setRemoteStream(null);
            setIsMuted(false);
            setIsCameraOff(false);
            setCallDuration(0);
          }, 1200);
        }
      },
      onLocalStream: (stream) => {
        setLocalStream(stream);
      },
      onRemoteStream: (stream) => {
        setRemoteStream(new MediaStream(stream.getTracks()));
      },
      onDiagnosticsUpdate: (entry, allLogs) => {
        setDiagnosticsLogs([...allLogs]);
      },
    });

    return () => {
      if (callManagerRef.current) {
        callManagerRef.current.cleanup();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Subscribe to incoming calls for current user
  useEffect(() => {
    if (!currentUser?.userId) {
      setIncomingCall(null);
      return;
    }

    const unsub = subscribeToIncomingCalls(currentUser.userId, (calls) => {
      if (calls && calls.length > 0 && !activeCall) {
        const call = calls[0];
        setIncomingCall(call);
        sounds.startIncomingRingtone();

        // Also trigger browser notification
        notificationService.notify({
          title: `Incoming ${call.type === 'VIDEO' ? 'Video' : 'Audio'} Call`,
          body: `${call.callerUsername} is calling you...`,
          type: 'call',
        });
      } else if (calls.length === 0 && incomingCall) {
        sounds.stopTone();
        setIncomingCall(null);
      }
    });

    return () => {
      unsub();
      sounds.stopTone();
    };
  }, [currentUser?.userId, activeCall]);

  /**
   * Start an outgoing call (Audio or Video)
   */
  const startCall = async (friend, isVideo = false) => {
    if (!currentUser || !friend) return;
    try {
      setActiveCall({
        callId: null,
        friendId: friend.friendId || friend.userId,
        friendUsername: friend.customNickname || friend.friendUsername || friend.username,
        type: isVideo ? CALL_TYPE.VIDEO : CALL_TYPE.VOICE,
        status: CALL_STATUS.RINGING,
        isCaller: true,
      });

      const callId = await callManagerRef.current.startCall({
        caller: { userId: currentUser.userId, username: currentUser.username },
        receiverId: friend.friendId || friend.userId,
        receiverUsername: friend.friendUsername || friend.username,
        isVideo,
      });

      setActiveCall((prev) => (prev ? { ...prev, callId } : null));
    } catch (err) {
      console.error('Failed to start call:', err);
      alert(`Call failed: ${err.message || 'Could not access microphone/camera'}`);
      endCall();
    }
  };

  /**
   * Accept an incoming call
   */
  const acceptCall = async () => {
    if (!incomingCall) return;
    sounds.stopTone();
    const callToAccept = incomingCall;
    setIncomingCall(null);

    setActiveCall({
      callId: callToAccept.callId,
      friendId: callToAccept.callerId,
      friendUsername: callToAccept.callerUsername,
      type: callToAccept.type,
      status: CALL_STATUS.RINGING,
      isCaller: false,
    });

    try {
      await callManagerRef.current.acceptCall(callToAccept);
    } catch (err) {
      console.error('Failed to accept call:', err);
      alert(`Could not connect call: ${err.message}`);
      endCall();
    }
  };

  /**
   * Reject an incoming call
   */
  const rejectCall = async () => {
    if (!incomingCall) return;
    sounds.stopTone();
    const id = incomingCall.callId;
    const callerId = incomingCall.callerId;
    setIncomingCall(null);
    await callManagerRef.current.rejectCall(id, callerId);
  };

  /**
   * End the current active call
   */
  const endCall = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await callManagerRef.current.endCall();
  };

  const toggleMute = () => {
    const next = callManagerRef.current.toggleMute();
    setIsMuted(next);
  };

  const toggleCamera = () => {
    const next = callManagerRef.current.toggleCamera();
    setIsCameraOff(next);
  };

  const value = {
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callDuration,
    diagnosticsLogs,
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
