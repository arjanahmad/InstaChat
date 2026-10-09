import React from 'react';
import { X, Check, Trash2, UserCheck } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useAuth } from '../../context/AuthContext';
import { acceptFriendRequest, rejectFriendRequest } from '../../services/friendService';

export default function FriendRequestsModal({ requests = [], onClose, onAction }) {
  const { currentUser } = useAuth();
  const [localRequests, setLocalRequests] = React.useState(requests);
  const [processingId, setProcessingId] = React.useState(null);

  React.useEffect(() => {
    setLocalRequests(requests);
  }, [requests]);

  const handleAccept = async (req) => {
    setProcessingId(req.requestId);
    try {
      await acceptFriendRequest(req, currentUser);
      setLocalRequests((prev) => prev.filter((r) => r.requestId !== req.requestId));
      if (onAction) onAction(req);
    } catch (err) {
      alert('Error accepting friend request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req) => {
    setProcessingId(req.requestId);
    try {
      await rejectFriendRequest(req.requestId);
      setLocalRequests((prev) => prev.filter((r) => r.requestId !== req.requestId));
      if (onAction) onAction(req);
    } catch (err) {
      alert('Error rejecting friend request: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel-elevated modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', maxWidth: '440px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={20} color="#00d2ff" /> Friend Requests ({localRequests.length})
          </h3>
          <button type="button" onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={16} />
          </button>
        </div>

        {localRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            No pending friend requests.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
            {localRequests.map((req) => (
              <div
                key={req.requestId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-glass)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar
                    src={req.senderProfileImageUrl}
                    name={req.senderUsername}
                    size={40}
                    showStatus={false}
                  />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff' }}>
                      {req.senderUsername}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                      Wants to be friends
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    data-testid="accept-request-btn"
                    disabled={processingId === req.requestId}
                    onClick={() => handleAccept(req)}
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                  >
                    <Check size={14} /> {processingId === req.requestId ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    disabled={processingId === req.requestId}
                    onClick={() => handleReject(req)}
                    className="btn-icon"
                    style={{ width: 32, height: 32, color: '#ef4444' }}
                    title="Decline"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
