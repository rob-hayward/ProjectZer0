// src/lib/services/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithAuth } from './api';
import { jwtStore } from '../stores/JWTStore';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('API Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calls fetch with the correct URL and options', async () => {
    const mockResponse = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
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
      statusText: 'Not Found',
    });

    await expect(fetchWithAuth('/test')).rejects.toThrow('API call failed: Not Found');
  });

  it('includes JWT token in Authorization header when available', async () => {
    const mockToken = 'mock-jwt-token';
    vi.spyOn(jwtStore, 'getToken').mockReturnValue(mockToken as any);

    const mockResponse = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
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
    vi.spyOn(jwtStore, 'getToken').mockReturnValue(null);

    const mockResponse = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
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