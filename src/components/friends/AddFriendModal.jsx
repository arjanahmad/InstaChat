import React, { useState } from 'react';
import { Search, UserPlus, Check, X, AlertCircle } from 'lucide-react';
import Avatar from '../common/Avatar';
import { useAuth } from '../../context/AuthContext';
import { searchUsers, sendFriendRequest } from '../../services/friendService';

export default function AddFriendModal({ onClose }) {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentMap, setSentMap] = useState({});
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const users = await searchUsers(searchTerm, currentUser.userId);
      setResults(users);
      if (users.length === 0) {
        setError(`No users found matching "${searchTerm}".`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUser) => {
    console.log('[AddFriendModal] handleSendRequest called for:', targetUser?.username, targetUser?.userId);
    try {
      await sendFriendRequest(currentUser, targetUser);
      console.log('[AddFriendModal] sendFriendRequest succeeded!');
      setSentMap((prev) => ({ ...prev, [targetUser.userId]: true }));
    } catch (err) {
      console.error('[AddFriendModal] sendFriendRequest error:', err);
      alert(err.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel-elevated modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '28px', maxWidth: '460px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Add New Friend
          </h3>
          <button type="button" onClick={onClose} className="btn-icon" style={{ width: 34, height: 34 }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={18}
              color="var(--text-dim)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '38px' }}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '0 18px' }}>
            Search
          </button>
        </form>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.85rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Results List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
          {results.map((u) => {
            const isSent = !!sentMap[u.userId];
            return (
              <div
                key={u.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-glass)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={u.profileImageUrl} name={u.username} size={40} online={u.online} />
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#ffffff' }}>
                      {u.username}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                      Wins: {u.wins || 0} • Coins: {u.coins || 100}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="add-friend-btn"
                  disabled={isSent}
                  onClick={() => handleSendRequest(u)}
                  className={isSent ? 'btn-secondary' : 'btn-primary'}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {isSent ? (
                    <><Check size={14} color="#10b981" /> Request Sent</>
                  ) : (
                    <><UserPlus size={14} /> Add</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
