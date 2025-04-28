import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWordData, checkWordExists } from './word';
import { fetchWithAuth } from './api';

// Mock the API module
vi.mock('./api', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('Word Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getWordData', () => {
    it('should fetch word data successfully', async () => {
      const mockWordData = {
        id: 'word-123',
        word: 'democracy',
        definitions: [
          {
            id: 'def-1',
            text: 'A system of government by the whole population',
          }
        ]
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockWordData);

      const result = await getWordData('democracy');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/word/democracy');
      expect(result).toEqual(mockWordData);
    });

    it('should encode word parameter correctly', async () => {
      const complexWord = 'complex word & spaces';
      const mockData = { id: 'word-456', word: complexWord };
      
      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockData);

      await getWordData(complexWord);

      expect(fetchWithAuth).toHaveBeenCalledWith(`/nodes/word/${encodeURIComponent(complexWord.toLowerCase())}`);
    });

    it('should return null for empty word', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await getWordData('');
      
      expect(consoleSpy).toHaveBeenCalledWith('getWordData called with empty word');
      expect(result).toBeNull();
      expect(fetchWithAuth).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should propagate API errors', async () => {
      const mockError = new Error('API error');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(getWordData('test')).rejects.toThrow('API error');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching word data:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('checkWordExists', () => {
    it('should return true when word exists', async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({ exists: true });

      const result = await checkWordExists('democracy');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/word/check/democracy');
      expect(result).toBe(true);
    });

    it('should return false when word does not exist', async () => {
      vi.mocked(fetchWithAuth).mockResolvedValueOnce({ exists: false });

      const result = await checkWordExists('nonexistentword');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/word/check/nonexistentword');
      expect(result).toBe(false);
    });

    it('should return false for empty word', async () => {
      const result = await checkWordExists('');
      
      expect(result).toBe(false);
      expect(fetchWithAuth).not.toHaveBeenCalled();
    });

    it('should return false on API error', async () => {
      const mockError = new Error('API error');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await checkWordExists('test');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Error checking word existence:', mockError);
      consoleSpy.mockRestore();
    });
  });
});