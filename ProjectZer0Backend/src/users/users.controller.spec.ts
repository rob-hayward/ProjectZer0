import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UserAuthService } from './user-auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';

describe('UsersController', () => {
  let controller: UsersController;
  let userAuthServiceMock: Partial<UserAuthService>;

  beforeEach(async () => {
    userAuthServiceMock = {
      findOrCreateUser: jest
        .fn()
        .mockImplementation(async (userData: UserProfile) => {
          return {
            user: { ...userData, sub: userData.sub },
            isNewUser: false,
          };
        }),
      updateUserProfile: jest
        .fn()
        .mockImplementation(async (userData: Partial<UserProfile>) => {
          return { ...userData, sub: 'testSub' } as UserProfile;
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UserAuthService, useValue: userAuthServiceMock }],
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
    it('should call findOrCreateUser method of UserAuthService', async () => {
      const userData: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        // Add other required fields from Auth0UserProfile
      };
      await controller.findOrCreateUser(userData);
      expect(userAuthServiceMock.findOrCreateUser).toHaveBeenCalledWith(
        userData,
      );
    });

    it('should return the result from UserAuthService', async () => {
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

  describe('updateUserProfile', () => {
    it('should call updateUserProfile method of UserAuthService', async () => {
      const userData: Partial<UserProfile> = {
        sub: 'testSub',
        preferred_username: 'testUser',
        email: 'test@example.com',
        mission_statement: 'Test mission',
      };
      await controller.updateUserProfile(userData);
      expect(userAuthServiceMock.updateUserProfile).toHaveBeenCalledWith(
        userData,
      );
    });

    it('should return the result from UserAuthService', async () => {
      const userData: Partial<UserProfile> = {
        sub: 'testSub',
        preferred_username: 'testUser',
        email: 'test@example.com',
        mission_statement: 'Test mission',
      };
      const result = await controller.updateUserProfile(userData);
      expect(result).toEqual({ ...userData, sub: 'testSub' });
    });

    it('should use JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        UsersController.prototype.updateUserProfile,
      );
      expect(guards).toContain(JwtAuthGuard);
    });
  });
});
