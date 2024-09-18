import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { Neo4jService } from '../neo4j/neo4j.service';

describe('UsersService', () => {
  let service: UsersService;
  let neo4jServiceMock: Partial<Neo4jService>;

  beforeEach(async () => {
    neo4jServiceMock = {
      run: jest.fn(),
      write: jest.fn(),
      testConnection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: Neo4jService, useValue: neo4jServiceMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOrCreateUser', () => {
    it('should create a new user if not exists', async () => {
      const mockUser = { auth0Id: 'auth0|123', email: 'test@example.com' };
      neo4jServiceMock.write = jest.fn().mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue({ properties: mockUser }) }],
      });

      const result = await service.findOrCreateUser(
        mockUser.auth0Id,
        mockUser.email,
      );
      expect(result).toEqual(mockUser);
      expect(neo4jServiceMock.write).toHaveBeenCalled();
    });
  });

  // Add more test cases for other methods
});
