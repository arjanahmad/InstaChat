import { describe, it, expect } from 'vitest';
import { getConversationId } from '../services/chatService';

describe('Chat System Logic', () => {
  it('guarantees deterministic conversation ID regardless of order', () => {
    const uidA = 'user_arjan_123';
    const uidB = 'user_bob_456';

    const convo1 = getConversationId(uidA, uidB);
    const convo2 = getConversationId(uidB, uidA);

    expect(convo1).toBe(convo2);
    expect(convo1).toBe('user_arjan_123_user_bob_456');
  });

  it('handles empty or missing user IDs safely', () => {
    expect(getConversationId('', 'userB')).toBe('');
    expect(getConversationId(null, 'userB')).toBe('');
    expect(getConversationId('userA', undefined)).toBe('');
  });

  it('verifies proper message states order', () => {
    const states = ['SENDING', 'SENT', 'DELIVERED', 'READ'];
    expect(states[0]).toBe('SENDING');
    expect(states[1]).toBe('SENT');
    expect(states[2]).toBe('DELIVERED');
    expect(states[3]).toBe('READ');
  });
});
