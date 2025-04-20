import { Test, TestingModule } from '@nestjs/testing';
import { Neo4jService } from './neo4j.service';
import { NEO4J_DRIVER } from './neo4j.constants';

describe('Neo4jService', () => {
  let service: Neo4jService;
  let mockDriver: any;
  let mockSession: any;

  beforeEach(async () => {
    mockSession = {
      run: jest.fn().mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(1) }],
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockDriver = {
      session: jest.fn(() => mockSession),
      getServerInfo: jest.fn().mockResolvedValue({ agent: 'Neo4j/5.23-aura' }),
      close: jest.fn().mockResolvedValue(undefined),
      verifyConnectivity: jest.fn().mockResolvedValue(true),
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
      expect(mockDriver.getServerInfo).toHaveBeenCalled();
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
      const params = { param1: 'value1' };

      await service.read(query, params);

      expect(mockDriver.session).toHaveBeenCalledWith(
        expect.objectContaining({ defaultAccessMode: 'READ' }),
      );
      expect(mockSession.run).toHaveBeenCalledWith(query, params);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should close session even if query fails', async () => {
      mockSession.run.mockRejectedValue(new Error('Query failed'));

      await expect(service.read('MATCH (n) RETURN n')).rejects.toThrow(
        'Query failed',
      );
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('write', () => {
    it('should execute a write query', async () => {
      const query = 'CREATE (n:Node) RETURN n';
      const params = { param1: 'value1' };

      await service.write(query, params);

      expect(mockDriver.session).toHaveBeenCalledWith(
        expect.objectContaining({ defaultAccessMode: 'WRITE' }),
      );
      expect(mockSession.run).toHaveBeenCalledWith(query, params);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should close session even if query fails', async () => {
      mockSession.run.mockRejectedValue(new Error('Query failed'));

      await expect(service.write('CREATE (n:Node) RETURN n')).rejects.toThrow(
        'Query failed',
      );
      expect(mockSession.close).toHaveBeenCalled();
    });
  });

  describe('onApplicationShutdown', () => {
    it('should close driver connection', async () => {
      await service.onApplicationShutdown();
      expect(mockDriver.close).toHaveBeenCalled();
    });
  });
});
