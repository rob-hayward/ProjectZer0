import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { UserAuthService } from '../users/user-auth.service';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { UserProfile } from '../users/user.model';
import { UnauthorizedException } from '@nestjs/common';

// Import the AuthenticatedRequest type from the controller
import { AuthenticatedRequest } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let userAuthService: jest.Mocked<UserAuthService>;
  let configService: jest.Mocked<ConfigService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: UserAuthService,
          useValue: {
            findOrCreateUser: jest.fn(),
            getUserProfile: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('test-jwt-token'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    userAuthService = module.get(UserAuthService);
    configService = module.get(ConfigService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('callback', () => {
    it('should handle new users', async () => {
      const mockUser: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        nickname: 'testuser',
        picture: 'https://example.com/picture.jpg',
        updated_at: new Date().toISOString(),
      };

      const mockDbUser: UserProfile = {
        ...mockUser,
        createdAt: new Date(),
        lastLogin: new Date(),
      };

      // Create properly typed request with UserProfile
      const mockReq = {
        user: mockUser,
      } as AuthenticatedRequest;

      const mockRes = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      userAuthService.findOrCreateUser.mockResolvedValue({
        user: mockDbUser,
        isNewUser: true,
      });

      await controller.callback(mockReq, mockRes);

      expect(userAuthService.findOrCreateUser).toHaveBeenCalledWith(mockUser);
      expect(jwtService.sign).toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'jwt',
        'test-jwt-token',
        expect.any(Object),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/edit-profile',
      );
    });

    it('should handle existing users', async () => {
      const mockUser: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        nickname: 'testuser',
        picture: 'https://example.com/picture.jpg',
        updated_at: new Date().toISOString(),
      };

      const mockDbUser: UserProfile = {
        ...mockUser,
        createdAt: new Date(),
        lastLogin: new Date(),
      };

      // Create properly typed request with UserProfile
      const mockReq = {
        user: mockUser,
      } as AuthenticatedRequest;

      const mockRes = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      userAuthService.findOrCreateUser.mockResolvedValue({
        user: mockDbUser,
        isNewUser: false,
      });

      await controller.callback(mockReq, mockRes);

      expect(userAuthService.findOrCreateUser).toHaveBeenCalledWith(mockUser);
      expect(jwtService.sign).toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'jwt',
        'test-jwt-token',
        expect.any(Object),
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/graph/dashboard',
      );
    });

    it('should handle errors during authentication', async () => {
      const mockUser: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
      };

      // Create properly typed request with UserProfile
      const mockReq = {
        user: mockUser,
      } as AuthenticatedRequest;

      const mockRes = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      userAuthService.findOrCreateUser.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.callback(mockReq, mockRes)).rejects.toThrow(
        'Error during authentication callback',
      );
    });
  });

  describe('logout', () => {
    it('should destroy the session and redirect to Auth0 logout', async () => {
      const mockReq = {
        user: { sub: 'auth0|123' },
        session: {
          destroy: jest.fn((cb) => cb()),
        },
      } as unknown as Request;

      const mockRes = {
        clearCookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      configService.get.mockImplementation((key: string) => {
        if (key === 'AUTH0_DOMAIN') return 'test.auth0.com';
        if (key === 'AUTH0_CLIENT_ID') return 'test-client-id';
        return 'mock_value';
      });

      await controller.logout(mockReq, mockRes);

      expect(mockReq.session.destroy).toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith('jwt');
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('https://test.auth0.com/v2/logout'),
      );
    });

    it('should handle session destruction errors', async () => {
      const mockReq = {
        user: { sub: 'auth0|123' },
        session: {
          destroy: jest.fn((cb) => cb(new Error('Session error'))),
        },
      } as unknown as Request;

      const mockRes = {
        clearCookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      await expect(controller.logout(mockReq, mockRes)).rejects.toThrow(
        'Error during logout',
      );
    });
  });

  describe('getProfile', () => {
    it('should return the user profile from database', async () => {
      const mockDbUser: UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        nickname: 'testuser',
        picture: 'https://example.com/picture.jpg',
        updated_at: new Date().toISOString(),
        createdAt: new Date(),
        lastLogin: new Date(),
      };

      // Create properly typed request with UserProfile
      const mockReq = {
        user: { sub: 'auth0|123' } as UserProfile,
      } as AuthenticatedRequest;

      userAuthService.getUserProfile.mockResolvedValue(mockDbUser);

      const result = await controller.getProfile(mockReq);

      expect(userAuthService.getUserProfile).toHaveBeenCalledWith('auth0|123');
      expect(result).toEqual(mockDbUser);
    });

    it('should throw UnauthorizedException if no user in request', async () => {
      const mockReq = {} as AuthenticatedRequest;

      await expect(controller.getProfile(mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle database errors', async () => {
      // Create properly typed request with UserProfile
      const mockReq = {
        user: { sub: 'auth0|123' } as UserProfile,
      } as AuthenticatedRequest;

      userAuthService.getUserProfile.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getProfile(mockReq)).rejects.toThrow(
        'Failed to fetch user profile',
      );
    });
  });

  describe('test', () => {
    it('should return a message indicating the backend is reachable', () => {
      const result = controller.test();
      expect(result).toEqual({ message: 'Backend is reachable' });
    });
  });
});
