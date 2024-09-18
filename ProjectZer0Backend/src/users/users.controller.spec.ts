import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersServiceMock: Partial<UsersService>;

  beforeEach(async () => {
    usersServiceMock = {
      findOrCreateUser: jest.fn(),
      getAllUsers: jest.fn(),
      getUserByAuth0Id: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      testConnection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOrCreateUser', () => {
    it('should call findOrCreateUser method of UsersService', async () => {
      const userData = { auth0Id: 'auth0|123', email: 'test@example.com' };
      await controller.findOrCreateUser(userData);
      expect(usersServiceMock.findOrCreateUser).toHaveBeenCalledWith(
        userData.auth0Id,
        userData.email,
      );
    });
  });

  // Add more test cases for other controller methods
});
