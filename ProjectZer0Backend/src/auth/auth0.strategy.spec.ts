// src/auth/auth0.strategy.spec.ts

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Auth0Strategy } from './auth0.strategy';

describe('Auth0Strategy', () => {
  let strategy: Auth0Strategy;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        Auth0Strategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => `mock_${key}`),
          },
        },
      ],
    }).compile();

    strategy = moduleRef.get<Auth0Strategy>(Auth0Strategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should validate and return the profile', async () => {
    const mockProfile = { id: '123', name: 'Test User' };
    const result = await strategy.validate(
      'token',
      'refreshToken',
      {},
      mockProfile,
    );
    expect(result).toEqual(mockProfile);
  });
});
