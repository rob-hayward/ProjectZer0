// src/auth/auth0.config.spec.ts

import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import auth0Config from './auth0.config';

describe('Auth0 Configuration', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [auth0Config],
        }),
      ],
    }).compile();

    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  it('should load Auth0 configuration', () => {
    expect(configService.get('auth0.domain')).toBeDefined();
    expect(configService.get('auth0.clientId')).toBeDefined();
    expect(configService.get('auth0.clientSecret')).toBeDefined();
    expect(configService.get('auth0.callbackURL')).toBeDefined();
    expect(configService.get('auth0.audience')).toBeDefined();
  });
});
