import { render, screen, fireEvent } from '@testing-library/svelte';
import Home from './+page.svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as auth0Service from '$lib/services/auth0';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));

// Mock auth0 service
vi.mock('$lib/services/auth0', () => ({
  initAuth0: vi.fn(),
  handleAuth0Login: vi.fn(),
}));

describe('Home Page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // Setup default mock for fetch
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ redirectUrl: 'http://localhost:5173/dashboard' }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the login button', () => {
    render(Home);
    expect(screen.getByText('ENTER')).toBeTruthy();
  });

  it('calls handleAuth0Login when the button is clicked', async () => {
    render(Home);
    const button = screen.getByText('ENTER');
    await fireEvent.click(button);

    expect(auth0Service.handleAuth0Login).toHaveBeenCalled();
  });

  it.todo('initializes Auth0 on mount');
  // When we're ready to implement this, we can change it to:
  // it('initializes Auth0 on mount', async () => {
  //   render(Home);
  //   await vi.runAllTimersAsync();
  //   expect(auth0Service.initAuth0).toHaveBeenCalled();
  // });
});