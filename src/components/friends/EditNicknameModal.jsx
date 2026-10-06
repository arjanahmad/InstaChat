import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateFriendNickname } from '../../services/friendService';

export default function EditNicknameModal({ friend, onClose, onUpdated }) {
  const { currentUser } = useAuth();
  const [nickname, setNickname] = useState(friend?.customNickname || '');
  const [saving, setSaving] = useState(false);

  if (!friend) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFriendNickname(currentUser.userId, friend.friendId, nickname);
      if (onUpdated) onUpdated(nickname);
      onClose();
    } catch (err) {
      alert('Failed to update nickname: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel-elevated modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', maxWidth: '380px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
            Set Friend Nickname
          </h3>
          <button type="button" onClick={onClose} className="btn-icon" style={{ width: 32, height: 32 }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Set a personal display name for <strong>{friend.friendUsername}</strong> (e.g. <em>Arjan ❤️</em>). Only visible to you.
        </p>

        <form onSubmit={handleSave}>
          <input
            type="text"
            placeholder="Enter nickname..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input-field"
            style={{ marginBottom: '16px' }}
            autoFocus
          />

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              <Check size={16} /> Save Nickname
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
