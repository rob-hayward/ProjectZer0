// src/auth/auth.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { Request, Response } from 'express';
import { Auth0UserProfile, UserProfile } from '../users/user.model';

describe('AuthController', () => {
  let controller: AuthController;
  let usersService: UsersService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findOrCreateUser: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    usersService = module.get<UsersService>(UsersService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('callback', () => {
    it('should handle new users', async () => {
      const mockUser: Auth0UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        nickname: 'testuser',
        picture: 'https://example.com/picture.jpg',
        updated_at: new Date().toISOString(),
      };

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

      const mockReq = {
        user: mockUser,
        session: {},
      } as unknown as Request;
      const mockRes = { redirect: jest.fn() } as unknown as Response;

      jest.spyOn(usersService, 'findOrCreateUser').mockResolvedValue({
        user: mockDbUser,
        isNewUser: true,
      });

      await controller.callback(mockReq, mockRes);

      expect(usersService.findOrCreateUser).toHaveBeenCalledWith(mockUser);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/edit-profile',
      );
    });

    it('should handle existing users', async () => {
      const mockUser: Auth0UserProfile = {
        sub: 'auth0|123',
        email: 'test@example.com',
        email_verified: true,
        name: 'Test User',
        nickname: 'testuser',
        picture: 'https://example.com/picture.jpg',
        updated_at: new Date().toISOString(),
      };

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

      const mockReq = {
        user: mockUser,
        session: {},
      } as unknown as Request;
      const mockRes = { redirect: jest.fn() } as unknown as Response;

      jest.spyOn(usersService, 'findOrCreateUser').mockResolvedValue({
        user: mockDbUser,
        isNewUser: false,
      });

      await controller.callback(mockReq, mockRes);

      expect(usersService.findOrCreateUser).toHaveBeenCalledWith(mockUser);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/dashboard',
      );
    });
  });

  describe('logout', () => {
    it('should destroy the session and redirect to Auth0 logout', async () => {
      const mockReq = {
        session: {
          destroy: jest.fn((cb) => cb()),
        },
      } as unknown as Request;
      const mockRes = { redirect: jest.fn() } as unknown as Response;
      configService.get = jest.fn().mockReturnValue('mock_value');

      await controller.logout(mockReq, mockRes);

      expect(mockReq.session.destroy).toHaveBeenCalled();
      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining('mock_value'),
      );
    });
  });

  describe('getProfile', () => {
    it('should return the user profile from session', () => {
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

      const mockReq = {
        session: {
          user: mockDbUser,
        },
      } as unknown as Request;

      const result = controller.getProfile(mockReq);

      expect(result).toEqual(mockDbUser);
    });

    it('should return null if no user in session', () => {
      const mockReq = { session: {} } as unknown as Request;

      const result = controller.getProfile(mockReq);

      expect(result).toBeNull();
    });
  });

  describe('test', () => {
    it('should return a message indicating the backend is reachable', () => {
      const result = controller.test();
      expect(result).toEqual({ message: 'Backend is reachable' });
    });
  });
});
