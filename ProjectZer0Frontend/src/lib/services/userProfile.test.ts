// src/lib/services/userProfile.test.ts

import { describe, it, expect, vi, afterEach } from 'vitest';
import { updateUserProfile } from './userProfile';
import { fetchWithAuth } from './api';

// Mock the fetchWithAuth function
vi.mock('./api', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('userProfile service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateUserProfile', () => {
    it('should call fetchWithAuth with correct parameters', async () => {
      const mockUserData = {
        sub: 'auth0|123',
        preferred_username: 'testUser',
        email: 'test@example.com',
        mission_statement: 'Test mission',
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockUserData);

      const result = await updateUserProfile(mockUserData);

      expect(fetchWithAuth).toHaveBeenCalledWith('/users/update-profile', {
        method: 'POST',
        body: JSON.stringify(mockUserData),
      });
      expect(result).toEqual(mockUserData);
    });

    it('should return null and log error on failure', async () => {
      const mockUserData = {
        sub: 'auth0|123',
        preferred_username: 'testUser',
      };

      vi.mocked(fetchWithAuth).mockRejectedValueOnce(new Error('Update failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await updateUserProfile(mockUserData);

      expect(consoleSpy).toHaveBeenCalledWith('Error updating user profile:', expect.any(Error));
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });
  });
});