import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionController } from './definition.controller';
import { DefinitionService } from './definition.service';

describe('DefinitionController', () => {
  let controller: DefinitionController;
  let service: DefinitionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DefinitionController],
      providers: [
        {
          provide: DefinitionService,
          useValue: {
            createDefinition: jest.fn(),
            getDefinition: jest.fn(),
            updateDefinition: jest.fn(),
            deleteDefinition: jest.fn(),
            setVisibilityStatus: jest.fn(),
            getVisibilityStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DefinitionController>(DefinitionController);
    service = module.get<DefinitionService>(DefinitionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDefinition', () => {
    it('should call service.createDefinition with correct parameters', async () => {
      const definitionData = {
        word: 'test',
        createdBy: 'user1',
        definitionText: 'A test definition',
      };
      await controller.createDefinition(definitionData);
      expect(service.createDefinition).toHaveBeenCalledWith(definitionData);
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

  // Add more tests for other methods
});
