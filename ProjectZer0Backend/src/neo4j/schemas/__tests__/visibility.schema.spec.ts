// src/neo4j/schemas/__tests__/visibility.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { VisibilitySchema } from '../visibility.schema';
import { Neo4jService } from '../../neo4j.service';
import { Logger } from '@nestjs/common';

describe('VisibilitySchema', () => {
  let schema: VisibilitySchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisibilitySchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    schema = module.get<VisibilitySchema>(VisibilitySchema);
    neo4jService = module.get(Neo4jService);
  });

  it('should be defined', () => {
    expect(schema).toBeDefined();
  });

  describe('setVisibilityPreference', () => {
    it('should set visibility preference and return the preference object', async () => {
      // Mock the ensureUserExists method call
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn() }],
      } as any);

      // Mock the set preference call
      const mockPreferenceJson = JSON.stringify({
        isVisible: true,
        source: 'user',
        timestamp: expect.any(Number),
      });

      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockPreferenceJson) }],
      } as any;

      neo4jService.write.mockResolvedValueOnce(mockResult);

      const result = await schema.setVisibilityPreference(
        'user1',
        'object1',
        true,
      );

      // Check first call - ensure user exists
      expect(neo4jService.write).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('MERGE (u:User {sub: $userId})'),
        { userId: 'user1' },
      );

      // Check second call - set preference
      expect(neo4jService.write).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          'MERGE (u)-[:HAS_VISIBILITY_PREFERENCES]->(vp:VisibilityPreferencesNode)',
        ),
        expect.objectContaining({
          userId: 'user1',
          preferenceJson: expect.any(String),
        }),
      );

      // Check result format
      expect(result).toEqual({
        isVisible: true,
        source: 'user',
        timestamp: expect.any(Number),
      });
    });

    it('should handle error when write operation fails', async () => {
      // Mock the ensure user exists to fail
      neo4jService.write.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        schema.setVisibilityPreference('user1', 'object1', true),
      ).rejects.toThrow('Database error');
    });

    it('should throw error when no records are returned', async () => {
      // Mock the ensureUserExists method success
      neo4jService.write.mockResolvedValueOnce({
        records: [{ get: jest.fn() }],
      } as any);

      // Mock the set preference call to return no records
      const mockResult = { records: [] } as any;
      neo4jService.write.mockResolvedValueOnce(mockResult);

      await expect(
        schema.setVisibilityPreference('user1', 'object1', true),
      ).rejects.toThrow(
        'Failed to set visibility preference - no records returned',
      );
    });
  });

  describe('getVisibilityPreference', () => {
    it('should return visibility preference when it exists', async () => {
      // Mock a valid preference JSON string
      const mockPreferenceJson = JSON.stringify({
        isVisible: true,
        source: 'user',
        timestamp: 1234567890,
      });

      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockPreferenceJson) }],
      } as any;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityPreference('user1', 'object1');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        { userId: 'user1' },
      );
      expect(result).toBe(true); // The isVisible value from the mock
    });

    it('should return undefined when no preference is found', async () => {
      // Mock no preference found
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(null) }],
      } as any;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityPreference('user1', 'object1');

      expect(result).toBeUndefined();
    });

    it('should return undefined when no records are returned', async () => {
      // Mock empty records array
      const mockResult = { records: [] } as any;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityPreference('user1', 'object1');

      expect(result).toBeUndefined();
    });

    it('should return undefined when JSON parsing fails', async () => {
      // Mock invalid JSON string
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue('invalid-json') }],
      } as any;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getVisibilityPreference('user1', 'object1');

      expect(result).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      const result = await schema.getVisibilityPreference('user1', 'object1');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllVisibilityPreferences', () => {
    it('should return all visibility preferences for a user', async () => {
      // Create a mock Neo4j node with properties that use the prefix
      const mockVpNode = {
        properties: {
          pref_obj1: JSON.stringify({
            isVisible: true,
            source: 'user',
            timestamp: 1234567890,
          }),
          pref_obj2: JSON.stringify({
            isVisible: false,
            source: 'user',
            timestamp: 1234567891,
          }),
          other_property: 'not a preference',
        },
      };

      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockVpNode) }],
      } as any;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAllVisibilityPreferences('user1');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (u:User {sub: $userId})'),
        { userId: 'user1' },
      );

      // Should have parsed the preferences correctly
      expect(result).toEqual({
        obj1: {
          isVisible: true,
          source: 'user',
          timestamp: 1234567890,
        },
        obj2: {
          isVisible: false,
          source: 'user',
          timestamp: 1234567891,
        },
      });

      // Should not include non-prefixed properties
      expect(result).not.toHaveProperty('other_property');
    });

    it('should return empty object when no preferences node exists', async () => {
      // Mock no vp node
      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(null) }],
      } as any;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAllVisibilityPreferences('user1');

      expect(result).toEqual({});
    });

    it('should return empty object when no records are returned', async () => {
      // Mock empty records array
      const mockResult = { records: [] } as any;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAllVisibilityPreferences('user1');

      expect(result).toEqual({});
    });

    it('should skip preferences that fail to parse', async () => {
      // Create a mock Neo4j node with both valid and invalid JSON
      const mockVpNode = {
        properties: {
          pref_obj1: JSON.stringify({
            isVisible: true,
            source: 'user',
            timestamp: 1234567890,
          }),
          pref_invalid: 'not-valid-json',
        },
      };

      const mockResult = {
        records: [{ get: jest.fn().mockReturnValue(mockVpNode) }],
      } as any;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getAllVisibilityPreferences('user1');

      // Should include the valid preference
      expect(result).toHaveProperty('obj1');

      // Should not include the invalid preference
      expect(result).not.toHaveProperty('invalid');
    });

    it('should handle database errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Database error'));

      const result = await schema.getAllVisibilityPreferences('user1');

      expect(result).toEqual({});
    });
  });

  describe('Private helper methods', () => {
    it('getSafePropertyName should create a property name with prefix', () => {
      // Access private method through type assertion
      const safePropertyName = (schema as any).getSafePropertyName('test-123');
      expect(safePropertyName).toMatch(/^pref_/);
      expect(safePropertyName).not.toContain('-');
    });

    it('getNodeIdFromProperty should extract the node ID correctly', () => {
      // Access private method through type assertion
      const nodeId = (schema as any).getNodeIdFromProperty('pref_test_123');
      expect(nodeId).toBe('test_123');
    });
  });
});
