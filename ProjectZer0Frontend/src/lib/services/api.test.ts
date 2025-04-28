// src/lib/services/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithAuth } from './api';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock the entire jwtStore
vi.mock('../stores/JWTStore', () => ({
  jwtStore: {
    getToken: vi.fn(),
  },
}));

// Import the mocked jwtStore
import { jwtStore } from '../stores/JWTStore';

describe('API Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calls fetch with the correct URL and options', async () => {
    const mockResponse = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      headers: {
        get: (name: string) => name === 'content-type' ? 'application/json' : null,
      },
    });

    const result = await fetchWithAuth('/test', { method: 'POST' });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/test',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        credentials: 'include',
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws an error when the response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('Not Found'),
    });

    // Use a regex or partial string match instead of exact string match
    await expect(fetchWithAuth('/test')).rejects.toThrow(/API call failed.*Not Found/);
  });

  it('includes JWT token in Authorization header when available', async () => {
    const mockToken = 'mock-jwt-token';
    (jwtStore.getToken as ReturnType<typeof vi.fn>).mockReturnValue(mockToken);
  
    const mockResponse = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      headers: {
        get: (name: string) => name === 'content-type' ? 'application/json' : null,
      },
    });
  
    await fetchWithAuth('/test');
  
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockToken}`,
        }),
      })
    );
  });

  it('does not include Authorization header when JWT token is not available', async () => {
    (jwtStore.getToken as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const mockResponse = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      headers: {
        get: (name: string) => name === 'content-type' ? 'application/json' : null,
      },
    });

    await fetchWithAuth('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/test',
      expect.objectContaining({
        headers: expect.not.objectContaining({
          'Authorization': expect.anything(),
        }),
      })
    );
  });
});