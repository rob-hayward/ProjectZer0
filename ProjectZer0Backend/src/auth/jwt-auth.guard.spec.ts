// ProjectZer0/ProjectZer0Backend/src/auth/jwt-auth.guard.spec.ts
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('should be defined', () => {
    expect(new JwtAuthGuard()).toBeDefined();
  });
});
