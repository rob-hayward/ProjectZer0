// src/nodes/belief/belief.controller.spec.ts

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

  // Add more tests for other methods
});
