// src/neo4j/schemas/__tests__/definition.schema.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionSchema } from '../definition.schema';
import { Neo4jService } from '../../neo4j.service';
import { UserSchema } from '../user.schema';
import { VoteSchema } from '../vote.schema';
import { Record, Result, Integer } from 'neo4j-driver';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import type { VoteStatus, VoteResult } from '../vote.schema';

describe('DefinitionSchema', () => {
  let schema: DefinitionSchema;
  let neo4jService: jest.Mocked<Neo4jService>;
  let voteSchema: jest.Mocked<VoteSchema>;

  // Mock data constants
  const mockDefinitionData = {
    id: 'definition-123',
    word: 'test',
    createdBy: 'user-456',
    definitionText: 'This is a test definition of the word test.',
    discussion: 'discussion-789',
  };

  const mockVoteResult: VoteResult = {
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
  };

  const mockVoteStatus: VoteStatus = {
    inclusionStatus: 'agree',
    inclusionPositiveVotes: 5,
    inclusionNegativeVotes: 2,
    inclusionNetVotes: 3,
    contentStatus: 'agree',
    contentPositiveVotes: 8,
    contentNegativeVotes: 1,
    contentNetVotes: 7,
  };

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
        {
          provide: UserSchema,
          useValue: {
            addCreatedNode: jest.fn(),
          },
        },
        {
          provide: VoteSchema,
          useValue: {
            vote: jest.fn(),
            getVoteStatus: jest.fn(),
            removeVote: jest.fn(),
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

    schema = module.get<DefinitionSchema>(DefinitionSchema);
    neo4jService = module.get(Neo4jService);
    voteSchema = module.get(VoteSchema);
  });

  // BASIC CRUD OPERATIONS
  describe('createDefinition', () => {
    it('should create a definition with all required fields', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.createDefinition(mockDefinitionData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (w:WordNode {word: $word})'),
        expect.objectContaining({
          id: mockDefinitionData.id,
          word: mockDefinitionData.word,
          createdBy: mockDefinitionData.createdBy,
          definitionText: mockDefinitionData.definitionText,
        }),
      );
      expect(result).toEqual(mockDefinitionData);
    });

    it('should create an API definition without user relationship', async () => {
      const apiDefinitionData = {
        ...mockDefinitionData,
        createdBy: 'FreeDictionaryAPI',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: apiDefinitionData }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.createDefinition(apiDefinitionData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining("WHERE userId <> 'FreeDictionaryAPI'"),
        expect.objectContaining(apiDefinitionData),
      );
      expect(result).toEqual(apiDefinitionData);
    });

    it('should create an AI-generated definition', async () => {
      const aiDefinitionData = {
        ...mockDefinitionData,
        createdBy: 'ProjectZeroAI',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: aiDefinitionData }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.createDefinition(aiDefinitionData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE userId <> 'FreeDictionaryAPI' AND userId <> 'ProjectZeroAI'",
        ),
        expect.objectContaining(aiDefinitionData),
      );
      expect(result).toEqual(aiDefinitionData);
    });

    it('should throw BadRequestException when definition text is empty', async () => {
      await expect(
        schema.createDefinition({
          ...mockDefinitionData,
          definitionText: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when definition text is whitespace only', async () => {
      await expect(
        schema.createDefinition({
          ...mockDefinitionData,
          definitionText: '   \t\n   ',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when definition text exceeds limit', async () => {
      const longDefinitionData = {
        ...mockDefinitionData,
        definitionText: 'a'.repeat(1501), // Exceeds MAX_DEFINITION_LENGTH
      };

      await expect(schema.createDefinition(longDefinitionData)).rejects.toThrow(
        BadRequestException,
      );
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle definition text at exact character limit', async () => {
      const exactLimitDefinition = {
        ...mockDefinitionData,
        definitionText: 'a'.repeat(1500), // Exactly at limit
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: exactLimitDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.createDefinition(exactLimitDefinition),
      ).resolves.toBeDefined();
    });

    it('should throw error when parent word does not exist or has not passed inclusion', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockResult);

      await expect(schema.createDefinition(mockDefinitionData)).rejects.toThrow(
        'Failed to create definition',
      );
    });

    it('should handle creation errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Database error'));

      await expect(schema.createDefinition(mockDefinitionData)).rejects.toThrow(
        'Failed to create definition: Database error',
      );
    });

    it('should handle unicode and special characters in definition text', async () => {
      const unicodeDefinition = {
        ...mockDefinitionData,
        definitionText: 'Test with émojis 🌟 and special chars: @#$%^&*()',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: unicodeDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.createDefinition(unicodeDefinition),
      ).resolves.toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return a definition when found', async () => {
      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getDefinition('definition-123');

      expect(neo4jService.read).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        { id: 'definition-123' },
      );
      expect(result).toEqual(mockDefinitionData);
    });

    it('should return null when definition is not found', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.read.mockResolvedValue(mockResult);

      const result = await schema.getDefinition('non-existent');

      expect(result).toBeNull();
    });

    it('should handle query errors gracefully', async () => {
      neo4jService.read.mockRejectedValue(new Error('Query failed'));

      await expect(schema.getDefinition('definition-123')).rejects.toThrow(
        'Failed to get definition: Query failed',
      );
    });
  });

  describe('updateDefinition', () => {
    it('should update a definition with all fields', async () => {
      const updateData = {
        definitionText: 'Updated definition text',
        discussion: 'new-discussion-id',
      };

      const updatedDefinition = {
        ...mockDefinitionData,
        ...updateData,
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: updatedDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      const result = await schema.updateDefinition(
        'definition-123',
        updateData,
      );

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MATCH (d:DefinitionNode {id: $id})'),
        expect.objectContaining({
          id: 'definition-123',
          ...updateData,
        }),
      );
      expect(result).toEqual(updatedDefinition);
    });

    it('should update only specified fields', async () => {
      const updateData = {
        definitionText: 'Only definition text updated',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockDefinitionData, ...updateData },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await schema.updateDefinition('definition-123', updateData);

      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('SET d.definitionText = $definitionText'),
        expect.objectContaining(updateData),
      );
    });

    it('should throw BadRequestException when definition text is empty', async () => {
      await expect(
        schema.updateDefinition('definition-123', { definitionText: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when definition text is whitespace only', async () => {
      await expect(
        schema.updateDefinition('definition-123', {
          definitionText: '   \t\n   ',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when definition text exceeds limit', async () => {
      const longText = 'a'.repeat(1501);

      await expect(
        schema.updateDefinition('definition-123', { definitionText: longText }),
      ).rejects.toThrow(BadRequestException);
      expect(neo4jService.write).not.toHaveBeenCalled();
    });

    it('should handle definition text at exact character limit during update', async () => {
      const exactLimitText = 'b'.repeat(1500);

      const mockRecord = {
        get: jest.fn().mockReturnValue({
          properties: { ...mockDefinitionData, definitionText: exactLimitText },
        }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.updateDefinition('definition-123', {
          definitionText: exactLimitText,
        }),
      ).resolves.toBeDefined();
    });

    it('should throw NotFoundException when definition does not exist', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.updateDefinition('non-existent', { definitionText: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle update errors gracefully', async () => {
      neo4jService.write.mockRejectedValue(new Error('Update failed'));

      await expect(
        schema.updateDefinition('definition-123', { definitionText: 'test' }),
      ).rejects.toThrow('Failed to update definition: Update failed');
    });
  });

  describe('deleteDefinition', () => {
    it('should delete a definition and related nodes', async () => {
      // Mock definition existence check
      const checkRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      const checkResult = {
        records: [checkRecord],
      } as unknown as Result;

      // Mock successful deletion
      const deleteResult = { records: [] } as unknown as Result;

      neo4jService.write
        .mockResolvedValueOnce(checkResult) // existence check
        .mockResolvedValueOnce(deleteResult); // deletion

      const result = await schema.deleteDefinition('definition-123');

      expect(neo4jService.write).toHaveBeenCalledTimes(2);
      expect(neo4jService.write).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('DETACH DELETE d, disc, c'),
        { id: 'definition-123' },
      );
      expect(result).toEqual({
        success: true,
        message: 'Definition definition-123 deleted successfully',
      });
    });

    it('should throw NotFoundException when definition does not exist', async () => {
      const mockResult = { records: [] } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockResult);

      await expect(schema.deleteDefinition('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle deletion errors gracefully', async () => {
      // Mock existence check success
      const checkRecord = {
        get: jest.fn().mockReturnValue({ properties: mockDefinitionData }),
      } as unknown as Record;
      const checkResult = {
        records: [checkRecord],
      } as unknown as Result;

      neo4jService.write
        .mockResolvedValueOnce(checkResult)
        .mockRejectedValueOnce(new Error('Delete failed'));

      await expect(schema.deleteDefinition('definition-123')).rejects.toThrow(
        'Failed to delete definition: Delete failed',
      );
    });
  });

  // DUAL VOTING SYSTEM TESTS
  describe('Dual Voting System', () => {
    describe('voteDefinitionInclusion', () => {
      it('should vote positively on definition inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteDefinitionInclusion(
          'definition-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          true,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on definition inclusion', async () => {
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteDefinitionInclusion(
          'definition-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          false,
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException when definition ID is empty', async () => {
        await expect(
          schema.voteDefinitionInclusion('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(
          schema.voteDefinitionInclusion('definition-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should handle voting errors gracefully', async () => {
        voteSchema.vote.mockRejectedValue(new Error('Vote failed'));

        await expect(
          schema.voteDefinitionInclusion('definition-123', 'user-456', true),
        ).rejects.toThrow('Failed to vote on definition: Vote failed');
      });
    });

    describe('voteDefinitionContent', () => {
      it('should vote positively on definition content when inclusion passed', async () => {
        // Mock definition with passed inclusion
        const mockDefinition = {
          id: 'definition-123',
          inclusionNetVotes: 5, // > 0, passed inclusion
        };
        jest.spyOn(schema, 'getDefinition').mockResolvedValue(mockDefinition);
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteDefinitionContent(
          'definition-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should vote negatively on definition content when inclusion passed', async () => {
        const mockDefinition = {
          id: 'definition-123',
          inclusionNetVotes: 3, // > 0, passed inclusion
        };
        jest.spyOn(schema, 'getDefinition').mockResolvedValue(mockDefinition);
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteDefinitionContent(
          'definition-123',
          'user-456',
          false,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          false,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inclusion threshold before allowing content voting - boundary case (exactly 0)', async () => {
        const mockDefinition = {
          id: 'definition-123',
          inclusionNetVotes: 0, // Exactly at boundary
        };
        jest.spyOn(schema, 'getDefinition').mockResolvedValue(mockDefinition);

        await expect(
          schema.voteDefinitionContent('definition-123', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should validate inclusion threshold before allowing content voting - boundary case (exactly 1)', async () => {
        const mockDefinition = {
          id: 'definition-123',
          inclusionNetVotes: 1, // Just above boundary
        };
        jest.spyOn(schema, 'getDefinition').mockResolvedValue(mockDefinition);
        voteSchema.vote.mockResolvedValue(mockVoteResult);

        const result = await schema.voteDefinitionContent(
          'definition-123',
          'user-456',
          true,
        );

        expect(voteSchema.vote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          true,
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should validate inclusion threshold before allowing content voting - negative case', async () => {
        const mockDefinition = {
          id: 'definition-123',
          inclusionNetVotes: -5, // Rejected
        };
        jest.spyOn(schema, 'getDefinition').mockResolvedValue(mockDefinition);

        await expect(
          schema.voteDefinitionContent('definition-123', 'user-456', false),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when definition ID is empty', async () => {
        await expect(
          schema.voteDefinitionContent('', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(
          schema.voteDefinitionContent('definition-123', '', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when definition does not exist', async () => {
        jest.spyOn(schema, 'getDefinition').mockResolvedValue(null);

        await expect(
          schema.voteDefinitionContent('definition-123', 'user-456', true),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.vote).not.toHaveBeenCalled();
      });

      it('should handle content voting errors gracefully', async () => {
        const mockDefinition = {
          id: 'definition-123',
          inclusionNetVotes: 5, // Passed inclusion
        };
        jest.spyOn(schema, 'getDefinition').mockResolvedValue(mockDefinition);
        voteSchema.vote.mockRejectedValue(new Error('Content vote failed'));

        await expect(
          schema.voteDefinitionContent('definition-123', 'user-456', true),
        ).rejects.toThrow(
          'Failed to vote on definition content: Content vote failed',
        );
      });
    });

    describe('getDefinitionVoteStatus', () => {
      it('should get vote status for a definition', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getDefinitionVoteStatus(
          'definition-123',
          'user-456',
        );

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
        );
        expect(result).toEqual(mockVoteStatus);
      });

      it('should return null when no vote status exists', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getDefinitionVoteStatus(
          'definition-123',
          'user-456',
        );

        expect(result).toBeNull();
      });

      it('should throw BadRequestException when definition ID is empty', async () => {
        await expect(
          schema.getDefinitionVoteStatus('', 'user-456'),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(
          schema.getDefinitionVoteStatus('definition-123', ''),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      });

      it('should handle vote status errors gracefully', async () => {
        voteSchema.getVoteStatus.mockRejectedValue(
          new Error('Vote status failed'),
        );

        await expect(
          schema.getDefinitionVoteStatus('definition-123', 'user-456'),
        ).rejects.toThrow(
          'Failed to get definition vote status: Vote status failed',
        );
      });
    });

    describe('removeDefinitionVote', () => {
      it('should remove inclusion vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeDefinitionVote(
          'definition-123',
          'user-456',
          'INCLUSION',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          'INCLUSION',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should remove content vote', async () => {
        voteSchema.removeVote.mockResolvedValue(mockVoteResult);

        const result = await schema.removeDefinitionVote(
          'definition-123',
          'user-456',
          'CONTENT',
        );

        expect(voteSchema.removeVote).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          'user-456',
          'CONTENT',
        );
        expect(result).toEqual(mockVoteResult);
      });

      it('should throw BadRequestException when definition ID is empty', async () => {
        await expect(
          schema.removeDefinitionVote('', 'user-456', 'INCLUSION'),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.removeVote).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when user ID is empty', async () => {
        await expect(
          schema.removeDefinitionVote('definition-123', '', 'CONTENT'),
        ).rejects.toThrow(BadRequestException);
        expect(voteSchema.removeVote).not.toHaveBeenCalled();
      });

      it('should handle remove vote errors gracefully', async () => {
        voteSchema.removeVote.mockRejectedValue(
          new Error('Remove vote failed'),
        );

        await expect(
          schema.removeDefinitionVote(
            'definition-123',
            'user-456',
            'INCLUSION',
          ),
        ).rejects.toThrow(
          'Failed to remove definition vote: Remove vote failed',
        );
      });
    });

    describe('getDefinitionVotes', () => {
      it('should get votes for a definition', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(mockVoteStatus);

        const result = await schema.getDefinitionVotes('definition-123');

        expect(voteSchema.getVoteStatus).toHaveBeenCalledWith(
          'DefinitionNode',
          { id: 'definition-123' },
          '',
        );
        expect(result).toEqual({
          inclusionPositiveVotes: mockVoteStatus.inclusionPositiveVotes,
          inclusionNegativeVotes: mockVoteStatus.inclusionNegativeVotes,
          inclusionNetVotes: mockVoteStatus.inclusionNetVotes,
          contentPositiveVotes: mockVoteStatus.contentPositiveVotes,
          contentNegativeVotes: mockVoteStatus.contentNegativeVotes,
          contentNetVotes: mockVoteStatus.contentNetVotes,
        });
      });

      it('should return null when no votes exist', async () => {
        voteSchema.getVoteStatus.mockResolvedValue(null);

        const result = await schema.getDefinitionVotes('definition-123');

        expect(result).toBeNull();
      });

      it('should handle vote retrieval errors gracefully', async () => {
        voteSchema.getVoteStatus.mockRejectedValue(
          new Error('Get votes failed'),
        );

        await expect(
          schema.getDefinitionVotes('definition-123'),
        ).rejects.toThrow('Failed to get definition votes: Get votes failed');
      });
    });
  });

  // VISIBILITY METHODS TESTS
  describe('Visibility Methods', () => {
    describe('setVisibilityStatus', () => {
      it('should set visibility status to visible', async () => {
        const mockDefinition = {
          id: 'definition-123',
          visibilityStatus: true,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinition }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.setVisibilityStatus('definition-123', true);

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (d:DefinitionNode {id: $definitionId})',
          ),
          { definitionId: 'definition-123', isVisible: true },
        );
        expect(result).toEqual(mockDefinition);
      });

      it('should set visibility status to hidden', async () => {
        const mockDefinition = {
          id: 'definition-123',
          visibilityStatus: false,
        };

        const mockRecord = {
          get: jest.fn().mockReturnValue({ properties: mockDefinition }),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.write.mockResolvedValue(mockResult);

        const result = await schema.setVisibilityStatus(
          'definition-123',
          false,
        );

        expect(neo4jService.write).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (d:DefinitionNode {id: $definitionId})',
          ),
          { definitionId: 'definition-123', isVisible: false },
        );
        expect(result).toEqual(mockDefinition);
      });

      it('should throw NotFoundException when definition does not exist', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.write.mockResolvedValue(mockResult);

        await expect(
          schema.setVisibilityStatus('non-existent', true),
        ).rejects.toThrow(NotFoundException);
      });

      it('should handle visibility update errors gracefully', async () => {
        neo4jService.write.mockRejectedValue(
          new Error('Visibility update failed'),
        );

        await expect(
          schema.setVisibilityStatus('definition-123', true),
        ).rejects.toThrow(
          'Failed to set visibility status: Visibility update failed',
        );
      });
    });

    describe('getVisibilityStatus', () => {
      it('should get visibility status when visible', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(true),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus('definition-123');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining(
            'MATCH (d:DefinitionNode {id: $definitionId})',
          ),
          { definitionId: 'definition-123' },
        );
        expect(result).toBe(true);
      });

      it('should get visibility status when hidden', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(false),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus('definition-123');

        expect(result).toBe(false);
      });

      it('should default to true when visibility status is not set', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(null),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus('definition-123');

        expect(result).toBe(true);
      });

      it('should default to true when definition does not exist', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getVisibilityStatus('non-existent');

        expect(result).toBe(true);
      });

      it('should handle visibility query errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Visibility query failed'),
        );

        await expect(
          schema.getVisibilityStatus('definition-123'),
        ).rejects.toThrow(
          'Failed to get visibility status: Visibility query failed',
        );
      });
    });
  });

  // ADDITIONAL UTILITY METHODS TESTS
  describe('Additional Utility Methods', () => {
    describe('getDefinitionsForWord', () => {
      it('should get all definitions for a word', async () => {
        const mockDefinitions = [
          { id: 'def-1', definitionText: 'First definition' },
          { id: 'def-2', definitionText: 'Second definition' },
        ];

        const mockRecords = mockDefinitions.map((def) => ({
          get: jest.fn().mockReturnValue({ properties: def }),
        })) as unknown as Record[];
        const mockResult = {
          records: mockRecords,
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getDefinitionsForWord('test');

        expect(neo4jService.read).toHaveBeenCalledWith(
          expect.stringContaining('MATCH (w:WordNode {word: $word})'),
          { word: 'test' },
        );
        expect(result).toHaveLength(2);
        expect(result).toEqual(mockDefinitions);
      });

      it('should return empty array when no definitions found', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.getDefinitionsForWord('nonexistent');

        expect(result).toEqual([]);
      });

      it('should handle query errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Query failed'));

        await expect(schema.getDefinitionsForWord('test')).rejects.toThrow(
          'Failed to get definitions for word: Query failed',
        );
      });
    });

    describe('checkDefinitions', () => {
      it('should return definition count', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(89)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.checkDefinitions();

        expect(neo4jService.read).toHaveBeenCalledWith(
          'MATCH (d:DefinitionNode) RETURN count(d) as count',
        );
        expect(result).toEqual({ count: 89 });
      });

      it('should return zero when no definitions exist', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(0)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.checkDefinitions();

        expect(result).toEqual({ count: 0 });
      });

      it('should handle large definition counts', async () => {
        const mockRecord = {
          get: jest.fn().mockReturnValue(Integer.fromNumber(500000)),
        } as unknown as Record;
        const mockResult = {
          records: [mockRecord],
        } as unknown as Result;

        neo4jService.read.mockResolvedValue(mockResult);

        const result = await schema.checkDefinitions();

        expect(result).toEqual({ count: 500000 });
      });

      it('should handle count errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(
          new Error('Database connection failed'),
        );

        await expect(schema.checkDefinitions()).rejects.toThrow(
          'Failed to check definitions: Database connection failed',
        );
      });

      it('should handle Neo4j query errors gracefully', async () => {
        neo4jService.read.mockRejectedValue(new Error('Node label not found'));

        await expect(schema.checkDefinitions()).rejects.toThrow(
          'Failed to check definitions: Node label not found',
        );
      });

      it('should handle empty result gracefully', async () => {
        const mockResult = { records: [] } as unknown as Result;
        neo4jService.read.mockResolvedValue(mockResult);

        // This should throw because there are no records to get count from
        await expect(schema.checkDefinitions()).rejects.toThrow();
      });
    });
  });

  // INPUT VALIDATION TESTS
  describe('Input Validation', () => {
    it('should throw BadRequestException for empty definition ID in voting methods', async () => {
      await expect(
        schema.voteDefinitionInclusion('', 'user-456', true),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.voteDefinitionContent('', 'user-456', true),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.getDefinitionVoteStatus('', 'user-456'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.removeDefinitionVote('', 'user-456', 'INCLUSION'),
      ).rejects.toThrow(BadRequestException);

      expect(voteSchema.vote).not.toHaveBeenCalled();
      expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      expect(voteSchema.removeVote).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty user ID in voting methods', async () => {
      await expect(
        schema.voteDefinitionInclusion('definition-123', '', true),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.voteDefinitionContent('definition-123', '', true),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.getDefinitionVoteStatus('definition-123', ''),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.removeDefinitionVote('definition-123', '', 'CONTENT'),
      ).rejects.toThrow(BadRequestException);

      expect(voteSchema.vote).not.toHaveBeenCalled();
      expect(voteSchema.getVoteStatus).not.toHaveBeenCalled();
      expect(voteSchema.removeVote).not.toHaveBeenCalled();
    });

    it('should handle empty strings and whitespace in definition text validation', async () => {
      await expect(
        schema.createDefinition({
          ...mockDefinitionData,
          definitionText: '',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.createDefinition({
          ...mockDefinitionData,
          definitionText: '   ',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        schema.updateDefinition('definition-123', { definitionText: '' }),
      ).rejects.toThrow(BadRequestException);

      expect(neo4jService.write).not.toHaveBeenCalled();
    });
  });

  // EDGE CASES AND BOUNDARY CONDITIONS
  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle Neo4j Integer conversion in vote results', async () => {
      const voteResultWithIntegers = {
        inclusionPositiveVotes: Integer.fromNumber(5),
        inclusionNegativeVotes: Integer.fromNumber(2),
        inclusionNetVotes: Integer.fromNumber(3),
        contentPositiveVotes: Integer.fromNumber(8),
        contentNegativeVotes: Integer.fromNumber(1),
        contentNetVotes: Integer.fromNumber(7),
      };

      voteSchema.vote.mockResolvedValue(voteResultWithIntegers as any);

      const result = await schema.voteDefinitionInclusion(
        'definition-123',
        'user-456',
        true,
      );

      // The schema should handle Integer conversion properly
      expect(result).toEqual(voteResultWithIntegers);
    });

    it('should handle concurrent voting scenarios', async () => {
      // Simulate concurrent votes by mocking different vote results
      voteSchema.vote
        .mockResolvedValueOnce(mockVoteResult)
        .mockResolvedValueOnce({
          ...mockVoteResult,
          inclusionPositiveVotes: 6,
          inclusionNetVotes: 4,
        });

      const result1 = await schema.voteDefinitionInclusion(
        'definition-123',
        'user-456',
        true,
      );
      const result2 = await schema.voteDefinitionInclusion(
        'definition-123',
        'user-789',
        true,
      );

      expect(result1.inclusionPositiveVotes).toBe(5);
      expect(result2.inclusionPositiveVotes).toBe(6);
    });

    it('should handle very large vote counts', async () => {
      const largeVoteResult = {
        inclusionPositiveVotes: 999999,
        inclusionNegativeVotes: 100000,
        inclusionNetVotes: 899999,
        contentPositiveVotes: 888888,
        contentNegativeVotes: 11111,
        contentNetVotes: 877777,
      };

      voteSchema.vote.mockResolvedValue(largeVoteResult);

      const result = await schema.voteDefinitionInclusion(
        'definition-123',
        'user-456',
        true,
      );

      expect(result).toEqual(largeVoteResult);
    });

    it('should handle definition with unicode and special characters', async () => {
      const unicodeDefinition = {
        ...mockDefinitionData,
        definitionText:
          'Définition avec caractères spéciaux: café, résumé, naïve 🌟',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: unicodeDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.createDefinition(unicodeDefinition),
      ).resolves.toBeDefined();
    });

    it('should handle definition text with line breaks and formatting', async () => {
      const formattedDefinition = {
        ...mockDefinitionData,
        definitionText: 'Line 1\nLine 2\r\nLine 3\tTabbed text',
      };

      const mockRecord = {
        get: jest.fn().mockReturnValue({ properties: formattedDefinition }),
      } as unknown as Record;
      const mockResult = {
        records: [mockRecord],
      } as unknown as Result;

      neo4jService.write.mockResolvedValue(mockResult);

      await expect(
        schema.createDefinition(formattedDefinition),
      ).resolves.toBeDefined();
    });

    it('should handle API vs user definition creation differences', async () => {
      // Test API definition
      const apiDef = { ...mockDefinitionData, createdBy: 'FreeDictionaryAPI' };
      const mockApiRecord = {
        get: jest.fn().mockReturnValue({ properties: apiDef }),
      } as unknown as Record;
      const mockApiResult = { records: [mockApiRecord] } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockApiResult);

      await schema.createDefinition(apiDef);
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('FreeDictionaryAPI'),
        expect.any(Object),
      );

      // Test user definition
      const userDef = { ...mockDefinitionData, createdBy: 'user-123' };
      const mockUserRecord = {
        get: jest.fn().mockReturnValue({ properties: userDef }),
      } as unknown as Record;
      const mockUserResult = { records: [mockUserRecord] } as unknown as Result;
      neo4jService.write.mockResolvedValue(mockUserResult);

      await schema.createDefinition(userDef);
      expect(neo4jService.write).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (u:User'),
        expect.any(Object),
      );
    });

    it('should handle boundary case for content voting threshold validation', async () => {
      // Test exactly at threshold (0 votes - should reject)
      const pendingDefinition = { id: 'def-1', inclusionNetVotes: 0 };
      jest.spyOn(schema, 'getDefinition').mockResolvedValue(pendingDefinition);

      await expect(
        schema.voteDefinitionContent('def-1', 'user-1', true),
      ).rejects.toThrow(BadRequestException);

      // Test just above threshold (1 vote - should allow)
      const approvedDefinition = { id: 'def-2', inclusionNetVotes: 1 };
      jest.spyOn(schema, 'getDefinition').mockResolvedValue(approvedDefinition);
      voteSchema.vote.mockResolvedValue(mockVoteResult);

      await expect(
        schema.voteDefinitionContent('def-2', 'user-1', true),
      ).resolves.toBeDefined();
    });

    it('should handle database transaction failures during creation', async () => {
      // Test partial failure scenario
      neo4jService.write
        .mockResolvedValueOnce({ records: [] } as unknown as Result) // First call fails (no parent word)
        .mockRejectedValueOnce(new Error('Transaction rolled back')); // Second call fails

      await expect(schema.createDefinition(mockDefinitionData)).rejects.toThrow(
        'Failed to create definition',
      );
    });
  });
});
