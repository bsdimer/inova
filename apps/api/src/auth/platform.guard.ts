import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthedRequest } from './jwt.guard';

/** Restricts platform endpoints (tenant provisioning etc.) to super_admin. */
@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.auth.platform_role !== 'super_admin') {
      throw new ForbiddenException('Platform access only');
    }
    return true;
  }
}
