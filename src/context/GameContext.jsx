import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from './AuthContext';
import {
  GAME_TYPES,
  GAME_STATUS,
  sendGameInvitation,
  acceptGameInvitation,
  declineGameInvitation,
  subscribeToGameInvitations,
  subscribeToGameRoom,
  makeTicTacToeMove,
  makeConnectFourMove,
  makeRpsChoice,
  makeMemoryFlipMove,
  requestRematch,
} from '../services/gameService';
import { notificationService } from '../services/notificationService';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const { currentUser } = useAuth();
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedGameType, setSelectedGameType] = useState(GAME_TYPES.TIC_TAC_TOE);

  // Subscribe to incoming game invitations
  useEffect(() => {
    if (!currentUser?.userId) {
      setPendingInvitations([]);
      return;
    }

    const unsub = subscribeToGameInvitations(currentUser.userId, (invites) => {
      setPendingInvitations(invites);
      if (invites.length > 0) {
        const latest = invites[0];
        notificationService.notify({
          title: `Game Challenge! 🎮`,
          body: `${latest.senderUsername} invited you to play ${latest.gameType.replace(/_/g, ' ')}`,
          type: 'game',
        });
      }
    });

    return unsub;
  }, [currentUser?.userId]);

  // Subscribe to active game room
  useEffect(() => {
    if (!activeRoomId) {
      setActiveRoom(null);
      return;
    }

    const unsub = subscribeToGameRoom(activeRoomId, (roomData) => {
      setActiveRoom(roomData);
      // Trigger confetti on win!
      if (roomData?.status === GAME_STATUS.FINISHED && roomData.winnerId === currentUser?.userId) {
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch (_) {}
      }
    });

    return unsub;
  }, [activeRoomId, currentUser?.userId]);

  /**
   * Invite a friend to play a game
   */
  const inviteFriendToGame = async (friend, gameType) => {
    if (!currentUser || !friend) return;
    try {
      const { room } = await sendGameInvitation(
        { userId: currentUser.userId, username: currentUser.username },
        { userId: friend.friendId || friend.userId, username: friend.friendUsername || friend.username },
        gameType
      );
      setActiveRoomId(room.roomId);
      setIsInviteModalOpen(false);
      return room.roomId;
    } catch (err) {
      console.error('Failed to invite friend:', err);
      alert('Failed to send game invitation: ' + err.message);
    }
  };

  /**
   * Accept an invitation
   */
  const acceptInvite = async (invitation) => {
    if (!currentUser) return;
    try {
      await acceptGameInvitation(invitation, currentUser);
      setActiveRoomId(invitation.roomId);
    } catch (err) {
      console.error('Failed to accept invite:', err);
    }
  };

  /**
   * Decline an invitation
   */
  const declineInvite = async (invitation) => {
    try {
      await declineGameInvitation(invitation.invitationId, invitation.roomId);
    } catch (err) {
      console.error('Failed to decline invite:', err);
    }
  };

  /**
   * Leave game room
   */
  const leaveRoom = () => {
    setActiveRoomId(null);
    setActiveRoom(null);
  };

  /**
   * Game Moves
   */
  const makeMove = async (param) => {
    if (!activeRoom || !currentUser) return;

    if (activeRoom.gameType === GAME_TYPES.TIC_TAC_TOE) {
      await makeTicTacToeMove(activeRoom, param, currentUser.userId);
    } else if (activeRoom.gameType === GAME_TYPES.CONNECT_FOUR) {
      await makeConnectFourMove(activeRoom, param, currentUser.userId);
    } else if (activeRoom.gameType === GAME_TYPES.ROCK_PAPER_SCISSORS) {
      await makeRpsChoice(activeRoom, param, currentUser.userId);
    } else if (activeRoom.gameType === GAME_TYPES.MEMORY_FLIP) {
      await makeMemoryFlipMove(activeRoom, param, currentUser.userId);
    }
  };

  const rematch = async () => {
    if (!activeRoom || !currentUser) return;
    await requestRematch(activeRoom, currentUser.userId);
  };

  const value = {
    activeRoomId,
    activeRoom,
    pendingInvitations,
    isInviteModalOpen,
    setIsInviteModalOpen,
    selectedGameType,
    setSelectedGameType,
    inviteFriendToGame,
    acceptInvite,
    declineInvite,
    leaveRoom,
    makeMove,
    rematch,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
