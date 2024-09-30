import { describe, it, expect, beforeEach } from 'vitest';
import { jwtStore } from './JWTStore';

describe('JWT Store', () => {
  beforeEach(() => {
    jwtStore.clearToken();
  });

  it('should set and get token', () => {
    const token = 'mock-jwt-token';
    jwtStore.setToken(token);
    expect(jwtStore.getToken()).toBe(token);
  });

  it('should clear token', () => {
    jwtStore.setToken('mock-jwt-token');
    jwtStore.clearToken();
    expect(jwtStore.getToken()).toBeNull();
  });
});