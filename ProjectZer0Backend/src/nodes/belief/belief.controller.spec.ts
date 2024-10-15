import { Test, TestingModule } from '@nestjs/testing';
import { BeliefController } from './belief.controller';
import { BeliefService } from './belief.service';

describe('BeliefController', () => {
  let controller: BeliefController;
  let service: BeliefService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BeliefController],
      providers: [
        {
          provide: BeliefService,
          useValue: {
            createBelief: jest.fn(),
            getBelief: jest.fn(),
            updateBelief: jest.fn(),
            deleteBelief: jest.fn(),
            setVisibilityStatus: jest.fn(),
            getVisibilityStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<BeliefController>(BeliefController);
    service = module.get<BeliefService>(BeliefService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createBelief', () => {
    it('should call service.createBelief with correct parameters', async () => {
      const beliefData = { statement: 'Test belief' };
      await controller.createBelief(beliefData);
      expect(service.createBelief).toHaveBeenCalledWith(beliefData);
    });
  });

  describe('setVisibilityStatus', () => {
    it('should call service.setVisibilityStatus with correct parameters', async () => {
      const id = 'test-id';
      const visibilityData = { isVisible: true };
      await controller.setVisibilityStatus(id, visibilityData);
      expect(service.setVisibilityStatus).toHaveBeenCalledWith(id, true);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should call service.getVisibilityStatus with correct parameters', async () => {
      const id = 'test-id';
      await controller.getVisibilityStatus(id);
      expect(service.getVisibilityStatus).toHaveBeenCalledWith(id);
    });
  });
});
