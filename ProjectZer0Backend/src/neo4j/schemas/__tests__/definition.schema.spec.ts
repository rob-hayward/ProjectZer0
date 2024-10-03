// src/neo4j/schemas/__tests__/definition.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionSchema } from '../definition.schema';
import { Neo4jService } from '../../neo4j.service';
import { Record, Result } from 'neo4j-driver';

describe('DefinitionSchema', () => {
  let definitionSchema: DefinitionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefinitionSchema,
        {
          provide: Neo4jService,
          useValue: {
            write: jest.fn(),
            read: jest.fn(),
          },
        },
      ],
    }).compile();

    definitionSchema = module.get<DefinitionSchema>(DefinitionSchema);
    neo4jService = module.get(Neo4jService);
  });

  describe('createDefinition', () => {
    it('should create a definition', async () => {
      const mockDefinition = {
        id: 'def-id',
        word: 'test',
        createdBy: 'user-id',
        definitionText: 'Test definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await definitionSchema.createDefinition(mockDefinition);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        mockDefinition,
      );
      expect(result).toEqual(mockDefinition);
    });
  });

  describe('getDefinition', () => {
    it('should return a definition when found', async () => {
      const mockDefinition = {
        id: 'def-id',
        definitionText: 'Test definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await definitionSchema.getDefinition('def-id');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        { id: 'def-id' },
      );
      expect(result).toEqual(mockDefinition);
    });

    it('should return null when definition is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await definitionSchema.getDefinition('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('updateDefinition', () => {
    it('should update a definition', async () => {
      const mockUpdatedDefinition = {
        id: 'def-id',
        definitionText: 'Updated definition',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockUpdatedDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await definitionSchema.updateDefinition('def-id', {
        definitionText: 'Updated definition',
      });

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        expect.objectContaining({
          id: 'def-id',
          updateData: { definitionText: 'Updated definition' },
        }),
      );
      expect(result).toEqual(mockUpdatedDefinition);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete a definition', async () => {
      await definitionSchema.deleteDefinition('def-id');

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        { id: 'def-id' },
      );
    });
  });
});
