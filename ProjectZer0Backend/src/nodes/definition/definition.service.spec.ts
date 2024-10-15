import { Test, TestingModule } from '@nestjs/testing';
import { DefinitionService } from './definition.service';
import { DefinitionSchema } from '../../neo4j/schemas/definition.schema';

describe('DefinitionService', () => {
  let service: DefinitionService;
  let schema: jest.Mocked<DefinitionSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefinitionService,
        {
          provide: DefinitionSchema,
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

    service = module.get<DefinitionService>(DefinitionService);
    schema = module.get(DefinitionSchema);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDefinition', () => {
    it('should call schema.createDefinition with correct parameters', async () => {
      const definitionData = {
        word: 'test',
        createdBy: 'user1',
        definitionText: 'A test definition',
      };
      await service.createDefinition(definitionData);
      expect(schema.createDefinition).toHaveBeenCalledWith(
        expect.objectContaining({
          ...definitionData,
          id: expect.any(String),
        }),
      );
    });
  });

  describe('setVisibilityStatus', () => {
    it('should call schema.setVisibilityStatus with correct parameters', async () => {
      const id = 'test-id';
      const isVisible = true;
      await service.setVisibilityStatus(id, isVisible);
      expect(schema.setVisibilityStatus).toHaveBeenCalledWith(id, isVisible);
    });
  });

  describe('getVisibilityStatus', () => {
    it('should call schema.getVisibilityStatus with correct parameters', async () => {
      const id = 'test-id';
      await service.getVisibilityStatus(id);
      expect(schema.getVisibilityStatus).toHaveBeenCalledWith(id);
    });
  });

  // Add more tests for other methods
});
