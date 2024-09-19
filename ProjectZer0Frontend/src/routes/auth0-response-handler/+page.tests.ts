import { render, waitFor } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import { getAuth0User } from '$lib/services/auth0';
import { verifyOrCreateUser } from '$lib/services/api';
import Auth0ResponseHandler from './+page.svelte';
import { describe, beforeEach, it, expect, vi } from 'vitest';

// Mock the modules we depend on
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));
vi.mock('$lib/services/auth0', () => ({
  getAuth0User: vi.fn(),
}));
vi.mock('$lib/services/api', () => ({
  verifyOrCreateUser: vi.fn(),
}));

describe('Auth0ResponseHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should redirect to dashboard for existing user', async () => {
    // Mock getAuth0User to return an existing user
    (getAuth0User as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: 'auth0|123',
      email: 'test@example.com',
    });

    // Mock verifyOrCreateUser to return an existing user
    (verifyOrCreateUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '123',
      email: 'test@example.com',
      isNewUser: false,
    });

    render(Auth0ResponseHandler);

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should redirect to edit profile for new user', async () => {
    // Mock getAuth0User to return a new user
    (getAuth0User as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: 'auth0|456',
      email: 'newuser@example.com',
    });

    // Mock verifyOrCreateUser to return a new user
    (verifyOrCreateUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '456',
      email: 'newuser@example.com',
      isNewUser: true,
    });

    render(Auth0ResponseHandler);

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/edit-profile');
    });
  });

  it('should redirect to auth error page on error', async () => {
    // Mock getAuth0User to throw an error
    (getAuth0User as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Auth error'));

    render(Auth0ResponseHandler);

    await waitFor(() => {
      expect(goto).toHaveBeenCalledWith('/auth-error');
    });
  });
});
