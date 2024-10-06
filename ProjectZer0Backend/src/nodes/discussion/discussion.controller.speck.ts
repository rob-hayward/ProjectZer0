import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionController } from './discussion.controller';
import { DiscussionService } from './discussion.service';

describe('DiscussionController', () => {
  let controller: DiscussionController;
  let service: jest.Mocked<DiscussionService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscussionController],
      providers: [
        {
          provide: DiscussionService,
          useValue: {
            createDiscussion: jest.fn(),
            getDiscussion: jest.fn(),
            updateDiscussion: jest.fn(),
            deleteDiscussion: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DiscussionController>(DiscussionController);
    service = module.get(DiscussionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDiscussion', () => {
    it('should call service.createDiscussion with correct parameters', async () => {
      const discussionData = {
        createdBy: 'user1',
        associatedNodeId: 'node1',
        associatedNodeType: 'BeliefNode',
      };
      await controller.createDiscussion(discussionData);
      expect(service.createDiscussion).toHaveBeenCalledWith(discussionData);
    });
  });

  describe('getDiscussion', () => {
    it('should call service.getDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      await controller.getDiscussion(id);
      expect(service.getDiscussion).toHaveBeenCalledWith(id);
    });
  });

  describe('updateDiscussion', () => {
    it('should call service.updateDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      const updateData = { someField: 'newValue' };
      await controller.updateDiscussion(id, updateData);
      expect(service.updateDiscussion).toHaveBeenCalledWith(id, updateData);
    });
  });

  describe('deleteDiscussion', () => {
    it('should call service.deleteDiscussion with correct parameters', async () => {
      const id = 'discussion1';
      await controller.deleteDiscussion(id);
      expect(service.deleteDiscussion).toHaveBeenCalledWith(id);
    });
  });
});
