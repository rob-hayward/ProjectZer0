import { Test, TestingModule } from '@nestjs/testing';
import { Neo4jService } from './neo4j.service';
import { NEO4J_DRIVER } from './neo4j.constants';

describe('Neo4jService', () => {
  let service: Neo4jService;
  let mockDriver: any;

  beforeEach(async () => {
    mockDriver = {
      session: jest.fn(() => ({
        run: jest.fn(),
        close: jest.fn(),
      })),
      getServerInfo: jest.fn().mockResolvedValue({ agent: 'Neo4j/5.23-aura' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Neo4jService,
        {
          provide: NEO4J_DRIVER,
          useValue: mockDriver,
        },
      ],
    }).compile();

    service = module.get<Neo4jService>(Neo4jService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('testConnection', () => {
    it('should return a success message with server info', async () => {
      const result = await service.testConnection();
      expect(result).toContain('Connection successful');
      expect(result).toContain('Neo4j/5.23-aura');
    });

    it('should throw an error if connection fails', async () => {
      mockDriver.getServerInfo.mockRejectedValue(
        new Error('Connection failed'),
      );
      await expect(service.testConnection()).rejects.toThrow(
        'Failed to connect to Neo4j',
      );
    });
  });

  describe('read', () => {
    it('should execute a read query', async () => {
      const query = 'MATCH (n) RETURN n';
      await service.read(query);
      expect(mockDriver.session).toHaveBeenCalledWith(
        expect.objectContaining({ defaultAccessMode: 'READ' }),
      );
    });
  });

  describe('write', () => {
    it('should execute a write query', async () => {
      const query = 'CREATE (n:Node) RETURN n';
      await service.write(query);
      expect(mockDriver.session).toHaveBeenCalledWith(
        expect.objectContaining({ defaultAccessMode: 'WRITE' }),
      );
    });
  });
});
