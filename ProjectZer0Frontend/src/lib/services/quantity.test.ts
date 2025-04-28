import { describe, it, expect, vi, afterEach } from 'vitest';
import { 
  getQuantityData, 
  createQuantity, 
  submitResponse, 
  getUserResponse, 
  getStatistics, 
  deleteUserResponse 
} from './quantity';
import { fetchWithAuth } from './api';

// Mock the API module
vi.mock('./api', () => ({
  fetchWithAuth: vi.fn(),
}));

describe('Quantity Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getQuantityData', () => {
    it('should fetch quantity data successfully', async () => {
      const mockQuantityData = {
        id: 'quantity-123',
        question: 'How many hours do you sleep per night?',
        unitCategoryId: 'time-unit-category',
        defaultUnitId: 'hours',
        createdBy: 'user-1',
        publicCredit: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        responseCount: 42
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockQuantityData);

      const result = await getQuantityData('quantity-123');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/quantity/quantity-123');
      expect(result).toEqual(mockQuantityData);
    });

    it('should return null for empty id', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = await getQuantityData('');
      
      expect(consoleSpy).toHaveBeenCalledWith('getQuantityData called with empty id');
      expect(result).toBeNull();
      expect(fetchWithAuth).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle and rethrow API errors', async () => {
      const mockError = new Error('API error');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(getQuantityData('test')).rejects.toThrow('API error');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching quantity data:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('createQuantity', () => {
    it('should create a quantity node successfully', async () => {
      const quantityData = {
        question: 'How many hours do you sleep per night?',
        unitCategoryId: 'time-unit-category',
        defaultUnitId: 'hours',
        initialComment: 'Initial thoughts about sleep',
        publicCredit: true
      };

      const mockResponse = {
        id: 'new-quantity-123',
        question: 'How many hours do you sleep per night?',
        unitCategoryId: 'time-unit-category',
        defaultUnitId: 'hours',
        initialComment: 'Initial thoughts about sleep',
        publicCredit: true,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        responseCount: 0
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockResponse);

      const result = await createQuantity(quantityData);

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/quantity', {
        method: 'POST',
        body: JSON.stringify(quantityData)
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle and rethrow API errors during creation', async () => {
      const quantityData = {
        question: 'Test question',
        unitCategoryId: 'test-category',
        defaultUnitId: 'test-unit'
      };

      const mockError = new Error('Creation failed');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(createQuantity(quantityData)).rejects.toThrow('Creation failed');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error creating quantity node:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('submitResponse', () => {
    it('should submit a response successfully', async () => {
      const responseData = {
        value: 7.5,
        unitId: 'hours'
      };

      const mockResponse = {
        id: 'response-123',
        quantityNodeId: 'quantity-123',
        userId: 'user-1',
        value: 7.5,
        unitId: 'hours',
        createdAt: new Date().toISOString()
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockResponse);

      const result = await submitResponse('quantity-123', 7.5, 'hours');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/quantity/quantity-123/response', {
        method: 'POST',
        body: JSON.stringify({ value: 7.5, unitId: 'hours' })
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle and rethrow API errors during submission', async () => {
      const mockError = new Error('Submission failed');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(submitResponse('quantity-123', 7.5, 'hours')).rejects.toThrow('Submission failed');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error submitting response:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('getUserResponse', () => {
    it('should fetch user response successfully', async () => {
      const mockResponse = {
        id: 'response-123',
        quantityNodeId: 'quantity-123',
        userId: 'user-1',
        value: 7.5,
        unitId: 'hours',
        createdAt: new Date().toISOString()
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockResponse);

      const result = await getUserResponse('quantity-123');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/quantity/quantity-123/response');
      expect(result).toEqual(mockResponse);
    });

    it('should return null when no response exists', async () => {
      const mockError = new Error('Not found');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await getUserResponse('quantity-123');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user response:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('getStatistics', () => {
    it('should fetch statistics successfully', async () => {
      const mockStatistics = {
        count: 42,
        mean: 7.2,
        median: 7.5,
        standardDeviation: 1.2,
        min: 4,
        max: 10,
        histogram: [
          { bin: '4-5', count: 3 },
          { bin: '6-7', count: 15 },
          { bin: '8-9', count: 20 },
          { bin: '9-10', count: 4 }
        ]
      };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockStatistics);

      const result = await getStatistics('quantity-123');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/quantity/quantity-123/statistics');
      expect(result).toEqual(mockStatistics);
    });

    it('should handle and rethrow API errors', async () => {
      const mockError = new Error('Statistics failed');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(getStatistics('quantity-123')).rejects.toThrow('Statistics failed');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching statistics:', mockError);
      consoleSpy.mockRestore();
    });
  });

  describe('deleteUserResponse', () => {
    it('should delete user response successfully', async () => {
      const mockResponse = { success: true };

      vi.mocked(fetchWithAuth).mockResolvedValueOnce(mockResponse);

      const result = await deleteUserResponse('quantity-123');

      expect(fetchWithAuth).toHaveBeenCalledWith('/nodes/quantity/quantity-123/response', {
        method: 'DELETE'
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle and rethrow API errors', async () => {
      const mockError = new Error('Deletion failed');
      vi.mocked(fetchWithAuth).mockRejectedValueOnce(mockError);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(deleteUserResponse('quantity-123')).rejects.toThrow('Deletion failed');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error deleting response:', mockError);
      consoleSpy.mockRestore();
    });
  });
});