import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../database';
import { config } from '../config';
import winston from 'winston';

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

interface User {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
}

interface Tenant {
  id: string;
  name: string;
  companyName: string;
  contactEmail: string;
  subscriptionStatus: string;
  subscriptionTier: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export class AuthService {
  private readonly saltRounds = 10;

  async register(
    tenantId: string,
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    role: string = 'user'
  ): Promise<User> {
    try {
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      const [user] = await query<User>(
        `INSERT INTO users (
          id, tenant_id, email, password_hash, first_name, last_name, role
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING 
          id, tenant_id as "tenantId", email, 
          first_name as "firstName", last_name as "lastName", 
          role, is_active as "isActive"`,
        [uuidv4(), tenantId, email.toLowerCase(), passwordHash, firstName, lastName, role]
      );

      logger.info('User registered successfully', { userId: user.id, email });
      return user;
    } catch (error) {
      logger.error('Failed to register user', { email, error });
      throw error;
    }
  }

  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const user = await this.validateCredentials(email, password);
      
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      await query(
        `UPDATE users SET last_login = NOW() WHERE id = $1`,
        [user.id]
      );

      const tokens = this.generateTokens(user);

      logger.info('User logged in successfully', { userId: user.id, email });
      return { user, tokens };
    } catch (error) {
      logger.error('Login failed', { email, error });
      throw error;
    }
  }

  private async validateCredentials(email: string, password: string): Promise<User> {
    const [dbUser] = await query<{
      id: string;
      tenant_id: string;
      email: string;
      password_hash: string;
      first_name?: string;
      last_name?: string;
      role: string;
      is_active: boolean;
    }>(
      `SELECT 
        id, tenant_id, email, password_hash, 
        first_name, last_name, role, is_active
      FROM users 
      WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!dbUser) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, dbUser.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    return {
      id: dbUser.id,
      tenantId: dbUser.tenant_id,
      email: dbUser.email,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      role: dbUser.role,
      isActive: dbUser.is_active,
    };
  }

  private generateTokens(user: User): AuthTokens {
    const payload: TokenPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: config.JWT_EXPIRATION,
    });

    const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
      expiresIn: config.JWT_REFRESH_EXPIRATION,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as TokenPayload;
      
      const [user] = await query<User>(
        `SELECT 
          id, tenant_id as "tenantId", email, role, is_active as "isActive"
        FROM users 
        WHERE id = $1`,
        [payload.userId]
      );

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return this.generateTokens(user);
    } catch (error) {
      logger.error('Failed to refresh tokens', { error });
      throw new Error('Invalid refresh token');
    }
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    try {
      return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const [user] = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);
    
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newPasswordHash, userId]
    );

    logger.info('Password changed successfully', { userId });
  }

  async resetPassword(email: string, newPassword: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);
    
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, user.id]
    );

    logger.info('Password reset successfully', { userId: user.id });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await query<User>(
      `SELECT 
        id, tenant_id as "tenantId", email, 
        first_name as "firstName", last_name as "lastName", 
        role, is_active as "isActive"
      FROM users 
      WHERE email = $1`,
      [email.toLowerCase()]
    );

    return user || null;
  }

  async getUserById(userId: string): Promise<User | null> {
    const [user] = await query<User>(
      `SELECT 
        id, tenant_id as "tenantId", email, 
        first_name as "firstName", last_name as "lastName", 
        role, is_active as "isActive"
      FROM users 
      WHERE id = $1`,
      [userId]
    );

    return user || null;
  }

  async createTenant(
    name: string,
    companyName: string,
    contactEmail: string,
    contactPhone?: string,
    address?: string
  ): Promise<Tenant> {
    try {
      const [tenant] = await query<Tenant>(
        `INSERT INTO tenants (
          id, name, company_name, contact_email, contact_phone, address
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          id, name, company_name as "companyName", 
          contact_email as "contactEmail", 
          subscription_status as "subscriptionStatus",
          subscription_tier as "subscriptionTier"`,
        [uuidv4(), name, companyName, contactEmail, contactPhone, address]
      );

      logger.info('Tenant created successfully', { tenantId: tenant.id, companyName });
      return tenant;
    } catch (error) {
      logger.error('Failed to create tenant', { companyName, error });
      throw error;
    }
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    const [tenant] = await query<Tenant>(
      `SELECT 
        id, name, company_name as "companyName", 
        contact_email as "contactEmail", 
        subscription_status as "subscriptionStatus",
        subscription_tier as "subscriptionTier"
      FROM tenants 
      WHERE id = $1`,
      [tenantId]
    );

    return tenant || null;
  }

  async updateUserRole(userId: string, newRole: string): Promise<void> {
    await query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
      [newRole, userId]
    );

    logger.info('User role updated', { userId, newRole });
  }

  async deactivateUser(userId: string): Promise<void> {
    await query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    logger.info('User deactivated', { userId });
  }

  async activateUser(userId: string): Promise<void> {
    await query(
      `UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    logger.info('User activated', { userId });
  }
}

export const authService = new AuthService();