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

  // Add more tests for other methods
});
