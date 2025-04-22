import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';
import { UserSchema } from '../../neo4j/schemas/user.schema';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { TEXT_LIMITS } from '../../constants/validation';

describe('DefinitionService', () => {
  let service: DefinitionService;
  let schema: jest.Mocked<DefinitionSchema>;
  let userSchema: jest.Mocked<UserSchema>;

  beforeEach(async () => {
    // Create mock implementations
    const mockDefinitionSchema = {
      createDefinition: jest.fn(),
      getDefinition: jest.fn(),
      updateDefinition: jest.fn(),
      deleteDefinition: jest.fn(),
      setVisibilityStatus: jest.fn(),
      getVisibilityStatus: jest.fn(),
      voteDefinition: jest.fn(),
      getDefinitionVoteStatus: jest.fn(),
      removeDefinitionVote: jest.fn(),
      getDefinitionVotes: jest.fn(),
    };

    const mockUserSchema = {
      addCreatedNode: jest.fn(),
      addParticipation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefinitionService,
        {
          provide: DefinitionSchema,
          useValue: mockDefinitionSchema,
        },
        {
          provide: UserSchema,
          useValue: mockUserSchema,
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

    service = module.get<DefinitionService>(DefinitionService);
    schema = module.get(DefinitionSchema);
    userSchema = module.get(UserSchema);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDefinition', () => {
    const validDefinitionData = {
      word: 'test',
      createdBy: 'user1',
      definitionText: 'A test definition',
    };

    it('should create a definition with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        ...validDefinitionData,
      };

      schema.createDefinition.mockResolvedValue(expectedResult);
      userSchema.addCreatedNode.mockResolvedValue(undefined);

      const result = await service.createDefinition(validDefinitionData);

      expect(schema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          ...validDefinitionData,
          id: expect.any(String),
        }),
      );
      expect(userSchema.addCreatedNode).toHaveBeenCalledWith(
        'user1',
        'test-id',
        'definition',
      );
      expect(result).toEqual(expectedResult);
    });

    it('should not track creation for API-created definitions', async () => {
      const apiDefinitionData = {
        word: 'test',
        createdBy: 'FreeDictionaryAPI',
        definitionText: 'A test definition',
      };

      const expectedResult = {
        id: 'test-id',
        ...apiDefinitionData,
      };

      schema.createDefinition.mockResolvedValue(expectedResult);

      const result = await service.createDefinition(apiDefinitionData);

      expect(schema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          ...apiDefinitionData,
          id: expect.any(String),
        }),
      );
      expect(userSchema.addCreatedNode).not.toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty word', async () => {
      await expect(
        service.createDefinition({
          ...validDefinitionData,
          word: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(schema.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        service.createDefinition({
          ...validDefinitionData,
          definitionText: '',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(schema.createDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for definition text exceeding max length', async () => {
      const longText = 'a'.repeat(TEXT_LIMITS.MAX_DEFINITION_LENGTH + 1);

      await expect(
        service.createDefinition({
          ...validDefinitionData,
          definitionText: longText,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(schema.createDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException when word does not exist', async () => {
      schema.createDefinition.mockRejectedValue(
        new NotFoundException('Word "test" not found'),
      );

      await expect(
        service.createDefinition(validDefinitionData),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle tracking errors gracefully', async () => {
      const expectedResult = {
        id: 'test-id',
        ...validDefinitionData,
      };

      schema.createDefinition.mockResolvedValue(expectedResult);
      userSchema.addCreatedNode.mockRejectedValue(new Error('Tracking error'));

      // Should not throw despite tracking error
      const result = await service.createDefinition(validDefinitionData);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getDefinition', () => {
    it('should return a definition when found', async () => {
      const mockDefinition = {
        id: 'test-id',
        definitionText: 'Test definition',
      };
      schema.getDefinition.mockResolvedValue(mockDefinition);

      const result = await service.getDefinition('test-id');

      expect(schema.getDefinition).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockDefinition);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(schema.getDefinition).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when definition not found', async () => {
      schema.getDefinition.mockResolvedValue(null);

      await expect(service.getDefinition('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateDefinition', () => {
    const validUpdateData = { definitionText: 'Updated definition' };

    it('should update a definition with valid data', async () => {
      const expectedResult = {
        id: 'test-id',
        definitionText: 'Updated definition',
      };

      schema.updateDefinition.mockResolvedValue(expectedResult);

      const result = await service.updateDefinition('test-id', validUpdateData);

      expect(schema.updateDefinition).toHaveBeenCalledWith(
        'test-id',
        validUpdateData,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(
        service.updateDefinition('', validUpdateData),
      ).rejects.toThrow(BadRequestException);
      expect(schema.updateDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty definition text', async () => {
      await expect(
        service.updateDefinition('test-id', { definitionText: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(schema.updateDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for definition text exceeding max length', async () => {
      const longText = 'a'.repeat(TEXT_LIMITS.MAX_DEFINITION_LENGTH + 1);

      await expect(
        service.updateDefinition('test-id', { definitionText: longText }),
      ).rejects.toThrow(BadRequestException);
      expect(schema.updateDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException when definition not found', async () => {
      schema.updateDefinition.mockRejectedValue(
        new NotFoundException('Definition with ID test-id not found'),
      );

      await expect(
        service.updateDefinition('test-id', validUpdateData),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDefinition', () => {
    it('should delete a definition successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Definition deleted successfully',
      };
      schema.deleteDefinition.mockResolvedValue(mockResult);

      const result = await service.deleteDefinition('test-id');

      expect(schema.deleteDefinition).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.deleteDefinition('')).rejects.toThrow(
        BadRequestException,
      );
      expect(schema.deleteDefinition).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException when definition not found', async () => {
      schema.deleteDefinition.mockRejectedValue(
        new NotFoundException('Definition with ID test-id not found'),
      );

      await expect(service.deleteDefinition('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('voteDefinition', () => {
    it('should process vote successfully', async () => {
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      schema.voteDefinition.mockResolvedValue(mockVoteResult);
      userSchema.addParticipation.mockResolvedValue(undefined);

      const result = await service.voteDefinition('test-id', 'user1', true);

      expect(schema.voteDefinition).toHaveBeenCalledWith(
        'test-id',
        'user1',
        true,
      );
      expect(userSchema.addParticipation).toHaveBeenCalledWith(
        'user1',
        'test-id',
        'voted',
      );
      expect(result).toEqual(mockVoteResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(service.voteDefinition('', 'user1', true)).rejects.toThrow(
        BadRequestException,
      );
      expect(schema.voteDefinition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.voteDefinition('test-id', '', true)).rejects.toThrow(
        BadRequestException,
      );
      expect(schema.voteDefinition).not.toHaveBeenCalled();
    });

    it('should handle tracking errors gracefully', async () => {
      const mockVoteResult = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };

      schema.voteDefinition.mockResolvedValue(mockVoteResult);
      userSchema.addParticipation.mockRejectedValue(
        new Error('Tracking error'),
      );

      // Should not throw despite tracking error
      const result = await service.voteDefinition('test-id', 'user1', true);
      expect(result).toEqual(mockVoteResult);
    });
  });

  describe('setVisibilityStatus', () => {
    it('should call schema.setVisibilityStatus with correct parameters', async () => {
      const mockResult = { id: 'test-id', visibilityStatus: true };
      schema.setVisibilityStatus.mockResolvedValue(mockResult);

      const result = await service.setVisibilityStatus('test-id', true);

      expect(schema.setVisibilityStatus).toHaveBeenCalledWith('test-id', true);
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.setVisibilityStatus('', true)).rejects.toThrow(
        BadRequestException,
      );
      expect(schema.setVisibilityStatus).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException when definition not found', async () => {
      schema.setVisibilityStatus.mockRejectedValue(
        new NotFoundException('Definition with ID test-id not found'),
      );

      await expect(
        service.setVisibilityStatus('test-id', true),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should call schema.getVisibilityStatus with correct parameters', async () => {
      schema.getVisibilityStatus.mockResolvedValue(true);

      const result = await service.getVisibilityStatus('test-id');

      expect(schema.getVisibilityStatus).toHaveBeenCalledWith('test-id');
      expect(result).toBe(true);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.getVisibilityStatus('')).rejects.toThrow(
        BadRequestException,
      );
      expect(schema.getVisibilityStatus).not.toHaveBeenCalled();
    });

    it('should handle NotFoundException when definition not found', async () => {
      schema.getVisibilityStatus.mockRejectedValue(
        new NotFoundException('Definition with ID test-id not found'),
      );

      await expect(service.getVisibilityStatus('test-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Tests for vote-related methods
  describe('getDefinitionVoteStatus', () => {
    it('should return vote status when found', async () => {
      const mockStatus = {
        status: 'agree' as 'agree' | 'disagree',
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      schema.getDefinitionVoteStatus.mockResolvedValue(mockStatus);

      const result = await service.getDefinitionVoteStatus('test-id', 'user1');

      expect(schema.getDefinitionVoteStatus).toHaveBeenCalledWith(
        'test-id',
        'user1',
      );
      expect(result).toEqual(mockStatus);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(
        service.getDefinitionVoteStatus('', 'user1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(
        service.getDefinitionVoteStatus('test-id', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeDefinitionVote', () => {
    it('should remove vote successfully', async () => {
      const mockResult = {
        positiveVotes: 4,
        negativeVotes: 2,
        netVotes: 2,
      };
      schema.removeDefinitionVote.mockResolvedValue(mockResult);

      const result = await service.removeDefinitionVote('test-id', 'user1');

      expect(schema.removeDefinitionVote).toHaveBeenCalledWith(
        'test-id',
        'user1',
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(service.removeDefinitionVote('', 'user1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.removeDefinitionVote('test-id', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getDefinitionVotes', () => {
    it('should return votes when found', async () => {
      const mockVotes = {
        positiveVotes: 5,
        negativeVotes: 2,
        netVotes: 3,
      };
      schema.getDefinitionVotes.mockResolvedValue(mockVotes);

      const result = await service.getDefinitionVotes('test-id');

      expect(schema.getDefinitionVotes).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(mockVotes);
    });

    it('should return null when no votes exist', async () => {
      schema.getDefinitionVotes.mockResolvedValue(null);

      const result = await service.getDefinitionVotes('test-id');

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for empty definition ID', async () => {
      await expect(service.getDefinitionVotes('')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
