import { Test, TestingModule } from '@nestjs/testing';
import { BeliefService } from './belief.service';
import { BeliefSchema } from '../../neo4j/schemas/belief.schema';

describe('BeliefService', () => {
  let service: BeliefService;
  let schema: jest.Mocked<BeliefSchema>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeliefService,
        {
          provide: BeliefSchema,
          useValue: {
            createBelief: jest.fn(),
            getBelief: jest.fn(),
            updateBelief: jest.fn(),
            deleteBelief: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BeliefService>(BeliefService);
    schema = module.get(BeliefSchema);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBelief', () => {
    it('should call schema.createBelief with correct parameters', async () => {
      const beliefData = { statement: 'Test belief' };
      await service.createBelief(beliefData);
      expect(schema.createBelief).toHaveBeenCalledWith(
        expect.objectContaining({
          ...beliefData,
          id: expect.any(String),
        }),
      );
    });
  });

  describe('getBelief', () => {
    it('should call schema.getBelief with correct parameters', async () => {
      const id = 'test-id';
      await service.getBelief(id);
      expect(schema.getBelief).toHaveBeenCalledWith(id);
    });
  });

  describe('updateBelief', () => {
    it('should call schema.updateBelief with correct parameters', async () => {
      const id = 'test-id';
      const updateData = { statement: 'Updated belief' };
      await service.updateBelief(id, updateData);
      expect(schema.updateBelief).toHaveBeenCalledWith(id, updateData);
    });
  });

  describe('deleteBelief', () => {
    it('should call schema.deleteBelief with correct parameters', async () => {
      const id = 'test-id';
      await service.deleteBelief(id);
      expect(schema.deleteBelief).toHaveBeenCalledWith(id);
    });
  });
});
