import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CallProvider, useCall } from './context/CallContext';
import { GameProvider, useGame } from './context/GameContext';
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import BottomNav from './components/common/BottomNav';
import AuthModal from './components/auth/AuthModal';
import IncomingCallDialog from './components/calls/IncomingCallDialog';
import ActiveCallModal from './components/calls/ActiveCallModal';
import GameInvitationDialog from './components/games/GameInvitationDialog';
import InviteFriendModal from './components/games/InviteFriendModal';
import ErrorBoundary from './components/common/ErrorBoundary';

// Views
import HomeView from './views/HomeView';
import ChatsView from './views/ChatsView';
import FriendsView from './views/FriendsView';
import CallsView from './views/CallsView';
import GamesView from './views/GamesView';
import NotificationsView from './views/NotificationsView';
import ProfileView from './views/ProfileView';
import SettingsView from './views/SettingsView';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const { activeRoomId, isInviteModalOpen, setIsInviteModalOpen, selectedGameType } = useGame();
  const [activeTab, setActiveTab] = useState('home');

  // Automatically open Games view when a game room becomes active
  useEffect(() => {
    if (activeRoomId) {
      setActiveTab('games');
    }
  }, [activeRoomId]);

  if (loading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          gap: '16px',
        }}
      >
        <img
          src="/logo.svg"
          alt="INSTAChat"
          style={{ width: 64, height: 64, borderRadius: 16, animation: 'pulseGlow 1.5s infinite' }}
        />
        <div style={{ color: 'var(--soft-cyan)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '0.05em' }}>
          LOADING INSTACHAT...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <ErrorBoundary title="Authentication screen issue">
        <AuthModal />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary title="INSTAChat Application issue" onHome={() => setActiveTab('home')}>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {/* Subtle ambient lighting */}
        <div className="ambient-bg" />

        {/* Desktop Sidebar Navigation */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Header Bar */}
          <Header activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab View Container */}
          <main
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              position: 'relative',
              marginBottom: 'var(--bottom-nav-height, 0px)',
            }}
            className="main-view-container"
          >
            {activeTab === 'home' && (
              <ErrorBoundary title="Home view issue" onHome={() => setActiveTab('home')}>
                <HomeView onNavigate={setActiveTab} />
              </ErrorBoundary>
            )}
            {activeTab === 'chats' && (
              <ErrorBoundary title="Chats view issue" onHome={() => setActiveTab('home')}>
                <ChatsView />
              </ErrorBoundary>
            )}
            {activeTab === 'friends' && (
              <ErrorBoundary title="Friends view issue" onHome={() => setActiveTab('home')}>
                <FriendsView onNavigateToChats={() => setActiveTab('chats')} />
              </ErrorBoundary>
            )}
            {activeTab === 'calls' && (
              <ErrorBoundary title="Calls hub issue" onHome={() => setActiveTab('home')}>
                <CallsView />
              </ErrorBoundary>
            )}
            {activeTab === 'games' && (
              <ErrorBoundary title="Games room issue" onHome={() => setActiveTab('home')}>
                <GamesView />
              </ErrorBoundary>
            )}
            {activeTab === 'notifications' && (
              <ErrorBoundary title="Notifications issue" onHome={() => setActiveTab('home')}>
                <NotificationsView onNavigate={setActiveTab} />
              </ErrorBoundary>
            )}
            {activeTab === 'profile' && (
              <ErrorBoundary title="Profile view issue" onHome={() => setActiveTab('home')}>
                <ProfileView />
              </ErrorBoundary>
            )}
            {activeTab === 'settings' && (
              <ErrorBoundary title="Settings view issue" onHome={() => setActiveTab('home')}>
                <SettingsView />
              </ErrorBoundary>
            )}
          </main>

          {/* Mobile Bottom Navigation */}
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Global Modals & WebRTC Overlays */}
        <IncomingCallDialog />
        <ActiveCallModal />
        <GameInvitationDialog />
        {isInviteModalOpen && (
          <InviteFriendModal
            gameType={selectedGameType}
            onClose={() => setIsInviteModalOpen(false)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary title="INSTAChat System Error">
      <AuthProvider>
        <ChatProvider>
          <CallProvider>
            <GameProvider>
              <AppContent />
            </GameProvider>
          </CallProvider>
        </ChatProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
