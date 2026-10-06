import { describe, it, expect } from 'vitest';

describe('Auth Validation Logic', () => {
  const validateAuthInput = (username, password) => {
    if (!username || username.trim().length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    return true;
  };

  it('accepts valid credentials', () => {
    expect(validateAuthInput('arjan_dev', 'password123')).toBe(true);
  });

  it('rejects short usernames', () => {
    expect(() => validateAuthInput('ar', 'password123')).toThrow('Username must be at least 3 characters long.');
  });

  it('rejects short passwords', () => {
    expect(() => validateAuthInput('arjan_dev', '12345')).toThrow('Password must be at least 6 characters.');
  });
});
