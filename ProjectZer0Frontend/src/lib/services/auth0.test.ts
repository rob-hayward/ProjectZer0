// src/lib/services/auth0.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtStore } from '../stores/JWTStore';
import * as auth0Module from './auth0';
import { userStore } from '../stores/userStore';
import type { UserProfile } from '../types/domain/user';

describe('Auth0 Service', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    vi.spyOn(jwtStore, 'setToken').mockImplementation(() => {});
    vi.spyOn(userStore, 'set').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.location = originalLocation;
  });

  describe('login', () => {
    it('redirects to login URL', () => {
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation,
      });

      auth0Module.login();

      expect(mockLocation.href).toBe('http://localhost:3000/api/auth/login');
    });
  });

  describe('getAuth0User', () => {
    it('returns user data on success', async () => {
      const mockUserData: UserProfile = {
        sub: 'auth0|123',
        name: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        nickname: 'testuser',
        picture: 'https://example.com/picture.jpg',
        updated_at: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      } as Response);

      const result = await auth0Module.getAuth0User();

      expect(result).toEqual(mockUserData);
      expect(userStore.set).toHaveBeenCalledWith(mockUserData);
    });

    it('returns null and logs error on fetch failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await auth0Module.getAuth0User();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error getting user data:', expect.any(Error));
    });

    it('redirects to login on 401 unauthorized', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation,
      });

      const result = await auth0Module.getAuth0User();

      expect(result).toBeNull();
      expect(mockLocation.href).toBe('http://localhost:3000/api/auth/login');
    });
  });

  describe('handleAuthCallback', () => {
    it('fetches user data after callback', async () => {
      const mockUserData: UserProfile = {
        sub: 'auth0|123',
        name: 'Test User',
        email: 'test@example.com',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      } as Response);

      await auth0Module.handleAuthCallback();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/profile',
        expect.any(Object)
      );
      expect(userStore.set).toHaveBeenCalledWith(mockUserData);
    });
  });

  describe('logout', () => {
    it('clears token, user store, and redirects to logout URL', () => {
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation,
      });

      const clearTokenSpy = vi.spyOn(jwtStore, 'clearToken');

      auth0Module.logout();

      expect(clearTokenSpy).toHaveBeenCalled();
      expect(userStore.set).toHaveBeenCalledWith(null);
      expect(mockLocation.href).toBe('http://localhost:3000/api/auth/logout');
    });
  });
});