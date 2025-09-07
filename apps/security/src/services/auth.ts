import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User, AuthToken, LoginRequest, LoginResponse, SecurityConfig } from '../types';
import { AuditService } from './audit';
import { logger } from '../utils/logger';

export class AuthService {
  private config: SecurityConfig;
  private auditService: AuditService;
  private users: Map<string, User> = new Map();
  private tokens: Map<string, AuthToken> = new Map();

  constructor(config: SecurityConfig, auditService: AuditService) {
    this.config = config;
    this.auditService = auditService;
    this.initializeDefaultAdmin();
  }

  private initializeDefaultAdmin(): void {
    const adminId = uuidv4();
    const adminUser: User = {
      id: adminId,
      email: 'admin@immigration-suite.gov',
      hashedPassword: bcrypt.hashSync('admin123!', 12),
      role: 'admin',
      permissions: [
        'users:read', 'users:write', 'users:delete',
        'ocr:process', 'ocr:read',
        'pdf:fill', 'pdf:read',
        'esign:create', 'esign:read', 'esign:sign',
        'case-status:read', 'case-status:track',
        'voice:translate', 'voice:session:manage',
        'admin:dashboard', 'admin:logs', 'admin:system',
        'security:read', 'security:write', 'security:incidents'
      ],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.users.set(adminId, adminUser);
    logger.info('Default admin user created', { email: adminUser.email });
  }

  async login(request: LoginRequest, ipAddress: string, userAgent: string): Promise<LoginResponse> {
    try {
      // Find user by email
      const user = Array.from(this.users.values()).find(u => u.email === request.email);
      
      if (!user) {
        await this.auditService.log({
          action: 'login_failed',
          resource: 'auth',
          details: { reason: 'user_not_found', email: request.email },
          ipAddress,
          userAgent,
          success: false,
          severity: 'medium'
        });
        
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Check if user is active
      if (!user.isActive) {
        await this.auditService.log({
          userId: user.id,
          action: 'login_failed',
          resource: 'auth',
          details: { reason: 'user_inactive', email: request.email },
          ipAddress,
          userAgent,
          success: false,
          severity: 'medium'
        });
        
        return {
          success: false,
          message: 'Account is disabled'
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(request.password, user.hashedPassword);
      
      if (!isValidPassword) {
        await this.auditService.log({
          userId: user.id,
          action: 'login_failed',
          resource: 'auth',
          details: { reason: 'invalid_password', email: request.email },
          ipAddress,
          userAgent,
          success: false,
          severity: 'medium'
        });
        
        return {
          success: false,
          message: 'Invalid email or password'
        };
      }

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Update last login
      user.lastLogin = new Date();
      user.updatedAt = new Date();
      this.users.set(user.id, user);

      // Log successful login
      await this.auditService.log({
        userId: user.id,
        action: 'login_success',
        resource: 'auth',
        details: { email: user.email },
        ipAddress,
        userAgent,
        success: true,
        severity: 'low'
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

    } catch (error: any) {
      logger.error('Login error:', error);
      
      await this.auditService.log({
        action: 'login_error',
        resource: 'auth',
        details: { error: error.message, email: request.email },
        ipAddress,
        userAgent,
        success: false,
        severity: 'high'
      });
      
      return {
        success: false,
        message: 'Login failed due to server error'
      };
    }
  }

  async logout(token: string, ipAddress: string, userAgent: string): Promise<void> {
    try {
      const authToken = this.tokens.get(token);
      
      if (authToken) {
        // Revoke the token
        authToken.isRevoked = true;
        this.tokens.set(token, authToken);

        await this.auditService.log({
          userId: authToken.userId,
          action: 'logout',
          resource: 'auth',
          details: { tokenType: authToken.type },
          ipAddress,
          userAgent,
          success: true,
          severity: 'low'
        });
      }
    } catch (error: any) {
      logger.error('Logout error:', error);
    }
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const accessTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const refreshTokenPayload = {
      userId: user.id,
      type: 'refresh'
    };

    const accessToken = (jwt.sign as any)(
      accessTokenPayload,
      this.config.jwt.accessTokenSecret,
      { expiresIn: this.config.jwt.accessTokenExpiry }
    );

    const refreshToken = (jwt.sign as any)(
      refreshTokenPayload,
      this.config.jwt.refreshTokenSecret,
      { expiresIn: this.config.jwt.refreshTokenExpiry }
    );

    // Store tokens
    const accessTokenRecord: AuthToken = {
      id: uuidv4(),
      userId: user.id,
      token: accessToken,
      type: 'access',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      isRevoked: false,
      createdAt: new Date()
    };

    const refreshTokenRecord: AuthToken = {
      id: uuidv4(),
      userId: user.id,
      token: refreshToken,
      type: 'refresh',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isRevoked: false,
      createdAt: new Date()
    };

    this.tokens.set(accessToken, accessTokenRecord);
    this.tokens.set(refreshToken, refreshTokenRecord);

    return { accessToken, refreshToken };
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const authToken = this.tokens.get(token);
      
      if (!authToken || authToken.isRevoked || authToken.expiresAt < new Date()) {
        return null;
      }

      const decoded = jwt.verify(token, this.config.jwt.accessTokenSecret as string) as any;
      const user = this.users.get(decoded.userId);
      
      return user && user.isActive ? user : null;
    } catch (error) {
      return null;
    }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string } | null> {
    try {
      const authToken = this.tokens.get(refreshToken);
      
      if (!authToken || authToken.isRevoked || authToken.expiresAt < new Date() || authToken.type !== 'refresh') {
        return null;
      }

      const decoded = jwt.verify(refreshToken, this.config.jwt.refreshTokenSecret as string) as any;
      const user = this.users.get(decoded.userId);
      
      if (!user || !user.isActive) {
        return null;
      }

      // Generate new access token
      const accessTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      const newAccessToken = (jwt.sign as any)(
        accessTokenPayload,
        this.config.jwt.accessTokenSecret,
        { expiresIn: this.config.jwt.accessTokenExpiry }
      );

      // Store new access token
      const newAccessTokenRecord: AuthToken = {
        id: uuidv4(),
        userId: user.id,
        token: newAccessToken,
        type: 'access',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        isRevoked: false,
        createdAt: new Date()
      };

      this.tokens.set(newAccessToken, newAccessTokenRecord);

      return { accessToken: newAccessToken };
    } catch (error) {
      return null;
    }
  }

  async createUser(userData: Partial<User>, createdBy: string): Promise<User> {
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(userData.hashedPassword || 'temp123!', 12);
    
    const user: User = {
      id: userId,
      email: userData.email!,
      hashedPassword,
      role: userData.role || 'user',
      permissions: userData.permissions || ['ocr:read', 'pdf:read'],
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: userData.metadata
    };

    this.users.set(userId, user);

    await this.auditService.log({
      userId: createdBy,
      action: 'user_created',
      resource: 'user',
      resourceId: userId,
      details: { email: user.email, role: user.role },
      ipAddress: '127.0.0.1',
      userAgent: 'system',
      success: true,
      severity: 'medium'
    });

    return user;
  }

  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  async updateUser(userId: string, updates: Partial<User>, updatedBy: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) return null;

    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);

    await this.auditService.log({
      userId: updatedBy,
      action: 'user_updated',
      resource: 'user',
      resourceId: userId,
      details: { changes: updates },
      ipAddress: '127.0.0.1',
      userAgent: 'system',
      success: true,
      severity: 'low'
    });

    return updatedUser;
  }

  async deleteUser(userId: string, deletedBy: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;

    this.users.delete(userId);

    // Revoke all tokens for this user
    for (const [token, authToken] of this.tokens) {
      if (authToken.userId === userId) {
        authToken.isRevoked = true;
        this.tokens.set(token, authToken);
      }
    }

    await this.auditService.log({
      userId: deletedBy,
      action: 'user_deleted',
      resource: 'user',
      resourceId: userId,
      details: { email: user.email },
      ipAddress: '127.0.0.1',
      userAgent: 'system',
      success: true,
      severity: 'high'
    });

    return true;
  }

  // Clean up expired tokens
  cleanupExpiredTokens(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [token, authToken] of this.tokens) {
      if (authToken.expiresAt < now || authToken.isRevoked) {
        this.tokens.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired tokens`);
    }
  }

  getStats(): { totalUsers: number; activeUsers: number; activeTokens: number } {
    const totalUsers = this.users.size;
    const activeUsers = Array.from(this.users.values()).filter(u => u.isActive).length;
    const activeTokens = Array.from(this.tokens.values()).filter(t => !t.isRevoked && t.expiresAt > new Date()).length;

    return { totalUsers, activeUsers, activeTokens };
  }
}