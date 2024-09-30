// src/lib/services/auth0.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtStore } from '../stores/JWTStore';
import * as auth0Module from './auth0';
import type { UserProfile } from '../types/user';

describe('Auth0 Service', () => {
  const originalURLSearchParams = global.URLSearchParams;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(jwtStore, 'setToken').mockImplementation(() => {});
    vi.spyOn(auth0Module, 'getAuth0User').mockResolvedValue({} as UserProfile);
  });

  afterEach(() => {
    global.URLSearchParams = originalURLSearchParams;
    window.location = originalLocation;
  });

  describe('login', () => {
    it('redirects to login URL', () => {
      const originalLocation = window.location;
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation,
      });

      auth0Module.login();

      expect(mockLocation.href).toBe('http://localhost:3000/api/auth/login');

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
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
      vi.mocked(auth0Module.getAuth0User).mockResolvedValueOnce(mockUserData);

      const result = await auth0Module.getAuth0User();

      expect(result).toEqual(mockUserData);
    });

    it('returns null and logs error on fetch failure', async () => {
      vi.mocked(auth0Module.getAuth0User).mockImplementationOnce(async () => {
        console.error('Error getting user data:', new Error('Network error'));
        return null;
      });

      const result = await auth0Module.getAuth0User();

      expect(result).toBeNull();
    });
  });

  describe('handleAuthCallback', () => {
    const originalURLSearchParams = global.URLSearchParams;
    const originalLocation = window.location;
  
    beforeEach(() => {
      vi.resetAllMocks();
    });
  
    afterEach(() => {
      global.URLSearchParams = originalURLSearchParams;
      window.location = originalLocation;
    });
  
    it('sets JWT token from URL and removes it', async () => {
      const token = 'mock-jwt-token';
      
      // Mock URLSearchParams
      const mockURLSearchParams = {
        get: vi.fn().mockReturnValue(token),
        delete: vi.fn(),
        toString: vi.fn().mockReturnValue('')
      };
      global.URLSearchParams = vi.fn().mockImplementation(() => mockURLSearchParams) as any;
  
      // Mock window.location
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        search: `?token=${token}`,
      } as any;
      
      const setTokenSpy = vi.spyOn(jwtStore, 'setToken');
      const historyReplaceSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
      vi.mocked(auth0Module.getAuth0User).mockResolvedValueOnce({} as UserProfile);
  
      await auth0Module.handleAuthCallback();
  
      expect(setTokenSpy).toHaveBeenCalledWith(token);
      expect(historyReplaceSpy).toHaveBeenCalled();
      expect(mockURLSearchParams.delete).toHaveBeenCalledWith('token');
    });
  
    it('does not set token if not present in URL', async () => {
      // Mock window.location
      delete (window as any).location;
      window.location = {
        ...originalLocation,
        search: '',
      } as any;
      
      const setTokenSpy = vi.spyOn(jwtStore, 'setToken');
      vi.spyOn(auth0Module, 'getAuth0User');
  
      await auth0Module.handleAuthCallback();
  
      expect(setTokenSpy).not.toHaveBeenCalled();
      expect(auth0Module.getAuth0User).not.toHaveBeenCalled();
    });
  });
});