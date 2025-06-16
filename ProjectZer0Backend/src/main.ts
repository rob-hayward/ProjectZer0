// ProjectZer0Backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as session from 'express-session';
import * as passport from 'passport';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Neo4jExceptionFilter } from './neo4j/neo4j-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'], // Enable all log levels
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  // Get environment configuration
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const isProduction = nodeEnv === 'production';

  // Configure allowed origins based on environment
  const allowedOrigins = isProduction
    ? ['https://projectzer0frontend.onrender.com', frontendUrl].filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000', frontendUrl].filter(
        Boolean,
      );

  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
    ],
  });

  app.use(cookieParser());

  // Enhanced session configuration for production
  const sessionSecret =
    configService.get<string>('SESSION_SECRET') || 'fallback-secret-key';

  logger.log(`Configuring session with secure: ${isProduction}`);

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      name: 'connect.sid', // Explicit session name
      cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        sameSite: isProduction ? 'none' : 'lax',
        domain: isProduction ? '.onrender.com' : undefined, // Allow subdomain sharing
      },
      // Force session creation for auth flows
      genid: () => {
        const sessionId = crypto.randomBytes(16).toString('hex');
        logger.debug(`Generated session ID: ${sessionId}`);
        return sessionId;
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Enhanced passport serialization with logging
  passport.serializeUser((user, done) => {
    logger.debug(`Serializing user: ${JSON.stringify(user)}`);
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    logger.debug(`Deserializing user: ${JSON.stringify(user)}`);
    done(null, user);
  });

  // Add session debugging middleware
  app.use((req, res, next) => {
    if (req.url.includes('/auth/')) {
      logger.debug(`Session ID: ${req.sessionID}`);
      logger.debug(`Session data: ${JSON.stringify(req.session)}`);
      logger.debug(`Cookies: ${JSON.stringify(req.cookies)}`);
    }
    next();
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filters - order matters, specific filters first
  app.useGlobalFilters(
    new Neo4jExceptionFilter(),
    new AllExceptionsFilter(logger),
  );

  // Use port from environment variable or default to 3000
  const port = configService.get<number>('MAIN_APP_PORT') || 3000;
  await app.listen(port);

  logger.log(`Application is running on port: ${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Frontend URL: ${frontendUrl || 'Not configured'}`);
}

bootstrap();
