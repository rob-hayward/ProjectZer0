// src/users/users.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UserAuthService } from './user-auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProfile } from './user.model';
import { InteractionService } from './interactions/interaction.service';
import { VisibilityService } from './visibility/visibility.service';
import { UserSchema } from '../neo4j/schemas/user.schema';

describe('UsersController', () => {
  let controller: UsersController;
  let userAuthServiceMock: Partial<UserAuthService>;
  let interactionServiceMock: Partial<InteractionService>;
  let visibilityServiceMock: Partial<VisibilityService>;
  let userSchemaMock: Partial<UserSchema>;

  beforeEach(async () => {
    userAuthServiceMock = {
      findOrCreateUser: jest.fn().mockImplementation(async (userData: any) => {
        return {
          user: { ...userData, sub: userData.sub || 'test-sub' },
          isNewUser: false,
        };
      }),
      updateUserProfile: jest
        .fn()
        .mockImplementation(async (userData: Partial<UserProfile>) => {
          return {
            ...userData,
            sub: userData.sub || 'test-sub',
          } as UserProfile;
        }),
      getUserProfile: jest.fn().mockImplementation(async (sub: string) => {
        return { sub, email: 'test@example.com' } as UserProfile;
      }),
    };

    interactionServiceMock = {
      getAllInteractions: jest.fn().mockResolvedValue({
        commented: { comment1: { commentIds: ['id1', 'id2'] } },
      }),
    };

    visibilityServiceMock = {
      setUserVisibilityPreference: jest.fn().mockResolvedValue({
        isVisible: true,
        source: 'user',
        timestamp: Date.now(),
      }),
      getUserVisibilityPreferences: jest.fn().mockResolvedValue({}),
    };

    userSchemaMock = {
      getUserActivityStats: jest.fn().mockResolvedValue({
        nodesCreated: 5,
        votesCast: 10,
        creationsByType: {
          word: 2,
          definition: 1,
          statement: 2,
        },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UserAuthService, useValue: userAuthServiceMock },
        { provide: InteractionService, useValue: interactionServiceMock },
        { provide: VisibilityService, useValue: visibilityServiceMock },
        { provide: UserSchema, useValue: userSchemaMock },
      ],
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

  describe('getUserActivity', () => {
    it('should combine stats from multiple sources', async () => {
      const req = { user: { sub: 'auth0|123' } };
      const result = await controller.getUserActivity(req);

      expect(userSchemaMock.getUserActivityStats).toHaveBeenCalledWith(
        'auth0|123',
      );
      expect(interactionServiceMock.getAllInteractions).toHaveBeenCalledWith(
        'auth0|123',
      );

      expect(result).toEqual({
        nodesCreated: 5,
        votesCast: 10,
        commentsMade: 2, // From the mock data with 2 comment IDs
        creationsByType: {
          word: 2,
          definition: 1,
          statement: 2,
        },
      });
    });
  });

  describe('getUserVisibilityPreferences', () => {
    it('should call the visibility service', async () => {
      const req = { user: { sub: 'auth0|123' } };
      await controller.getUserVisibilityPreferences(req);

      expect(
        visibilityServiceMock.getUserVisibilityPreferences,
      ).toHaveBeenCalledWith('auth0|123');
    });
  });

  describe('setUserVisibilityPreference', () => {
    it('should call the visibility service with correct parameters', async () => {
      const req = { user: { sub: 'auth0|123' } };
      const body = { nodeId: 'node1', isVisible: true };

      await controller.setUserVisibilityPreference(req, body);

      expect(
        visibilityServiceMock.setUserVisibilityPreference,
      ).toHaveBeenCalledWith('auth0|123', 'node1', true);
    });
  });
});
