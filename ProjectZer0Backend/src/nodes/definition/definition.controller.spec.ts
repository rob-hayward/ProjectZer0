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

  // Add more tests for other methods
});
