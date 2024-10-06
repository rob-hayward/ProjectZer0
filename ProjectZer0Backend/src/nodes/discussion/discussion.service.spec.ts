import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionService } from './discussion.service';
import { DiscussionSchema } from '../../neo4j/schemas/discussion.schema';

describe('DiscussionService', () => {
  let service: DiscussionService;
  let schema: jest.Mocked<DiscussionSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionService,
        {
          provide: DiscussionSchema,
          useValue: {
            createDiscussion: jest.fn(),
            getDiscussion: jest.fn(),
            updateDiscussion: jest.fn(),
            deleteDiscussion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiscussionService>(DiscussionService);
    schema = module.get(DiscussionSchema);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDiscussion', () => {
    it('should call schema.createDiscussion with correct parameters', async () => {
      const discussionData = {
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
      };
      await service.createDiscussion(discussionData);
      expect(schema.createDiscussion).toHaveBeenCalledWith(
        expect.objectContaining({
          ...discussionData,
          id: expect.any(String),
        }),
      );
    });
  });

  describe('getDiscussion', () => {
    it('should call schema.getDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      await service.getDiscussion(id);
      expect(schema.getDiscussion).toHaveBeenCalledWith(id);
    });
  });

  describe('updateDiscussion', () => {
    it('should call schema.updateDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      const updateData = { someField: 'newValue' };
      await service.updateDiscussion(id, updateData);
      expect(schema.updateDiscussion).toHaveBeenCalledWith(id, updateData);
    });
  });

  describe('deleteDiscussion', () => {
    it('should call schema.deleteDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      await service.deleteDiscussion(id);
      expect(schema.deleteDiscussion).toHaveBeenCalledWith(id);
    });
  });
});
