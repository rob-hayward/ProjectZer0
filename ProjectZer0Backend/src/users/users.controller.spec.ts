import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';

describe('UsersController', () => {
  let controller: UsersController;
  let usersServiceMock: Partial<UsersService>;

  beforeEach(async () => {
    usersServiceMock = {
      findOrCreateUser: jest
        .fn()
        .mockImplementation(async (userData: UserProfile) => {
          return {
            user: { ...userData, sub: userData.sub },
            isNewUser: false,
          };
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOrCreateUser', () => {
    it('should call findOrCreateUser method of UsersService', async () => {
      const userData: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        // Add other required fields from Auth0UserProfile
      };
      await controller.findOrCreateUser(userData);
      expect(usersServiceMock.findOrCreateUser).toHaveBeenCalledWith(userData);
    });

    it('should return the result from UsersService', async () => {
      const userData: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        // Add other required fields from Auth0UserProfile
      };
      const result = await controller.findOrCreateUser(userData);
      expect(result).toEqual({
        user: { ...userData, sub: userData.sub },
        isNewUser: false,
      });
    });

    it('should use JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        UsersController.prototype.findOrCreateUser,
      );
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
