import { describe, it, expect, vi, afterEach } from 'vitest';
import { getStatementData, createStatement, getStatementNetwork } from './statement';
import { fetchWithAuth } from './api';

// Mock the API module
vi.mock('./api', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('Statement Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStatementData', () => {
    it('should fetch statement data successfully', async () => {
      const mockStatementData = {
        id: 'statement-123',
        statement: 'Democracy requires participation',
        type: 'statement',
        createdAt: new Date().toISOString(),
        createdBy: 'user-1',
        publicCredit: true,
        updatedAt: new Date().toISOString(),
        positiveVotes: 15,
        negativeVotes: 3,
        keywords: [{ word: 'democracy', frequency: 1, source: 'user' }],
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockStatementData);

      const result = await getStatementData('statement-123');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/statement/statement-123');
      expect(result).toEqual(mockStatementData);
    });

    it('should return null for empty id', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await getStatementData('');
      
      expect(consoleSpy).toHaveBeenCalledWith('getStatementData called with empty id');
      expect(result).toBeNull();
      expect(fetchWithAuth).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle and rethrow API errors', async () => {
      const mockError = new Error('API error');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(getStatementData('test')).rejects.toThrow('API error');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching statement data:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('createStatement', () => {
    it('should create a statement successfully', async () => {
      const statementData = {
        statement: 'Democracy requires active participation',
        userKeywords: ['democracy', 'participation'],
        initialComment: 'Initial thoughts',
        publicCredit: true
      };

      const mockResponse = {
        id: 'new-statement-123',
        statement: 'Democracy requires active participation',
        type: 'statement',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        createdBy: 'user-1',
        publicCredit: true,
        positiveVotes: 0,
        negativeVotes: 0,
        initialComment: 'Initial thoughts',
        keywords: [
          { word: 'democracy', frequency: 1, source: 'user' },
          { word: 'participation', frequency: 1, source: 'user' }
        ]
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockResponse);

      const result = await createStatement(statementData);

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/statement', {
        method: 'POST',
        body: JSON.stringify(statementData)
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle and rethrow API errors during creation', async () => {
      const statementData = {
        statement: 'Test statement',
      };

      const mockError = new Error('Creation failed');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(createStatement(statementData)).rejects.toThrow('Creation failed');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error creating statement:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('getStatementNetwork', () => {
    it('should fetch statement network with default options', async () => {
      const mockStatements = [
        { 
          id: 'stmt-1', 
          statement: 'First statement', 
          type: 'statement',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'user-1',
          publicCredit: true,
          positiveVotes: 5,
          negativeVotes: 1
        },
        { 
          id: 'stmt-2', 
          statement: 'Second statement',
          type: 'statement',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'user-2',
          publicCredit: true,
          positiveVotes: 3,
          negativeVotes: 2
        }
      ];

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockStatements);

      const result = await getStatementNetwork();

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/statement/network');
      expect(result).toEqual(mockStatements);
    });

    it('should apply filtering options correctly', async () => {
      const options = {
        limit: 10,
        offset: 20,
        keywords: ['democracy', 'justice'],
        userId: 'user-123',
        sortBy: 'netPositive',
        sortDirection: 'desc'
      };

      const mockStatements = [
        { 
          id: 'stmt-3', 
          statement: 'Filtered statement',
          type: 'statement',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'user-123',
          publicCredit: true,
          positiveVotes: 10,
          negativeVotes: 1,
          keywords: [
            { word: 'democracy', frequency: 1, source: 'user' }
          ]
        }
      ];

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockStatements);

      const result = await getStatementNetwork(options);

      // Check that the URL was constructed correctly with all parameters
      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/nodes/statement/network?limit=10&offset=20&keyword=democracy&keyword=justice&userId=user-123&sortBy=netPositive&sortDirection=desc'
      );
      expect(result).toEqual(mockStatements);
    });

    it('should handle partial options correctly', async () => {
      const options = {
        limit: 5,
        keywords: ['democracy']
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce([]);

      await getStatementNetwork(options);

      expect(fetchWithAuth).toHaveBeenCalledWith(
        '/nodes/statement/network?limit=5&keyword=democracy'
      );
    });
  });
});