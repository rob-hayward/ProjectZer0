// src/auth/jwt-auth.guard.ts
import { Injectable, Logger, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  // Fix: Add the proper parameters for handleRequest
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    if (err || !user) {
      this.logger.warn(
        `Authentication failed: ${err?.message || 'No user found'}`,
      );
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
