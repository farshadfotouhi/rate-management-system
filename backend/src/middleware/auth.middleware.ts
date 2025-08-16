import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import winston from 'winston';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = await authService.verifyAccessToken(token);
    
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    logger.error('Authentication failed', { error });
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: allowedRoles,
      });
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export async function validateTenantAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const requestedTenantId = req.params.tenantId || req.body.tenantId;
  
  if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
    if (req.user.role !== 'admin') {
      logger.warn('Tenant access violation attempt', {
        userId: req.user.userId,
        userTenantId: req.user.tenantId,
        requestedTenantId,
      });
      res.status(403).json({ error: 'Access denied to this tenant' });
      return;
    }
  }

  next();
}