/**
 * Authentication manager for secure token storage and user session management
 */

import { createStorage, StorageEnum } from '@extension/storage/lib/base/index.js';
import type { AuthTokens, AuthResponse } from '../api/api-client.js';
import { apiClient } from '../api/api-client.js';
import { messageRouter } from '../messaging/message-router.js';
import { stateManager } from '../messaging/state-manager.js';
import { createMessage } from '../messaging/message-types.js';
import { CryptoManager } from './crypto-manager.js';

// Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
  tokens: AuthTokens | null;
  lastLoginTime: Date | null;
  sessionExpiresAt: Date | null;
}

// Session configuration
interface SessionConfig {
  sessionTimeout: number; // in milliseconds
  tokenRefreshThreshold: number; // refresh when token expires within this time
  maxLoginAttempts: number;
  lockoutDuration: number; // in milliseconds
}

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
};

// Login attempt tracking
interface LoginAttempt {
  email: string;
  timestamp: Date;
  success: boolean;
  ipAddress?: string;
}

/**
 * Authentication manager with secure token storage and session management
 */
export class AuthManager {
  private config: SessionConfig;
  private cryptoManager: CryptoManager;
  private authStorage: any;
  private sessionStorage: any;
  private loginAttempts: LoginAttempt[] = [];
  private sessionCheckInterval: number | null = null;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config };
    this.cryptoManager = new CryptoManager();
    this.initializeStorage();
    this.setupMessageHandlers();
    this.startSessionMonitoring();
  }

  /**
   * Initialize secure storage for authentication data
   */
  private initializeStorage(): void {
    // Encrypted storage for sensitive auth data
    this.authStorage = createStorage<{
      encryptedTokens?: string;
      user?: AuthState['user'];
      lastLoginTime?: string;
      sessionExpiresAt?: string;
    }>(
      'auth-data',
      {},
      {
        storageEnum: StorageEnum.Local, // Use local storage for security
        liveUpdate: false,
      }
    );

    // Session storage for temporary data
    this.sessionStorage = createStorage<{
      sessionId?: string;
      lastActivity?: string;
      deviceFingerprint?: string;
    }>(
      'session-data',
      {},
      {
        storageEnum: StorageEnum.Session,
        liveUpdate: false,
      }
    );
  }

  /**
   * Setup message handlers for authentication
   */
  private setupMessageHandlers(): void {
    messageRouter.on('auth:login', async (message) => {
      const { email, password } = message.data;
      return this.login(email, password);
    });

    messageRouter.on('auth:logout', async () => {
      return this.logout();
    });

    messageRouter.on('auth:status', async () => {
      return this.getAuthState();
    });

    messageRouter.on('profile:get', async () => {
      const authState = await this.getAuthState();
      if (!authState.isAuthenticated) {
        throw new Error('Authentication required');
      }
      return authState;
    });
  }

  /**
   * Start session monitoring
   */
  private startSessionMonitoring(): void {
    // Check session validity every minute
    this.sessionCheckInterval = setInterval(async () => {
      await this.checkSessionValidity();
    }, 60 * 1000);

    // Check on startup
    this.checkSessionValidity();
  }

  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    // Check for account lockout
    if (this.isAccountLocked(email)) {
      throw new Error('Account temporarily locked due to too many failed attempts');
    }

    try {
      // Attempt login via API
      const authResponse = await apiClient.login(email, password);
      
      // Record successful login attempt
      this.recordLoginAttempt(email, true);
      
      // Store authentication data securely
      await this.storeAuthData(authResponse);
      
      // Update application state
      await this.updateAuthState(authResponse);
      
      // Generate session
      await this.createSession();
      
      // Broadcast authentication status
      this.broadcastAuthStatus();
      
      return authResponse;
    } catch (error: any) {
      // Record failed login attempt
      this.recordLoginAttempt(email, false);
      
      throw new Error(error.message || 'Login failed');
    }
  }

  /**
   * Register new user
   */
  async register(
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string
  ): Promise<AuthResponse> {
    try {
      const authResponse = await apiClient.register(email, password, firstName, lastName);
      
      // Store authentication data
      await this.storeAuthData(authResponse);
      
      // Update application state
      await this.updateAuthState(authResponse);
      
      // Generate session
      await this.createSession();
      
      // Broadcast authentication status
      this.broadcastAuthStatus();
      
      return authResponse;
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Notify API of logout
      await apiClient.logout();
    } catch (error) {
      console.warn('API logout failed:', error);
    }

    // Clear stored authentication data
    await this.clearAuthData();
    
    // Clear session data
    await this.clearSession();
    
    // Update application state
    stateManager.updateState({
      auth: {
        isAuthenticated: false,
        user: null,
        tokens: null,
      },
    });
    
    // Broadcast authentication status
    this.broadcastAuthStatus();
  }

  /**
   * Get current authentication state
   */
  async getAuthState(): Promise<AuthState> {
    const authData = await this.authStorage.get();
    
    if (!authData.encryptedTokens || !authData.user) {
      return {
        isAuthenticated: false,
        user: null,
        tokens: null,
        lastLoginTime: null,
        sessionExpiresAt: null,
      };
    }

    try {
      // Decrypt tokens
      const tokens = await this.cryptoManager.decrypt(authData.encryptedTokens);
      const parsedTokens: AuthTokens = JSON.parse(tokens);
      
      // Check if tokens are expired
      if (Date.now() >= parsedTokens.expiresAt) {
        // Try to refresh tokens
        const refreshed = await this.refreshTokens();
        if (!refreshed) {
          await this.clearAuthData();
          return {
            isAuthenticated: false,
            user: null,
            tokens: null,
            lastLoginTime: null,
            sessionExpiresAt: null,
          };
        }
        
        // Get updated auth data after refresh
        const updatedAuthData = await this.authStorage.get();
        const updatedTokens = await this.cryptoManager.decrypt(updatedAuthData.encryptedTokens!);
        const updatedParsedTokens: AuthTokens = JSON.parse(updatedTokens);
        
        return {
          isAuthenticated: true,
          user: authData.user,
          tokens: updatedParsedTokens,
          lastLoginTime: authData.lastLoginTime ? new Date(authData.lastLoginTime) : null,
          sessionExpiresAt: authData.sessionExpiresAt ? new Date(authData.sessionExpiresAt) : null,
        };
      }

      return {
        isAuthenticated: true,
        user: authData.user,
        tokens: parsedTokens,
        lastLoginTime: authData.lastLoginTime ? new Date(authData.lastLoginTime) : null,
        sessionExpiresAt: authData.sessionExpiresAt ? new Date(authData.sessionExpiresAt) : null,
      };
    } catch (error) {
      console.error('Failed to decrypt auth data:', error);
      await this.clearAuthData();
      return {
        isAuthenticated: false,
        user: null,
        tokens: null,
        lastLoginTime: null,
        sessionExpiresAt: null,
      };
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshTokens(): Promise<boolean> {
    try {
      const authData = await this.authStorage.get();
      if (!authData.encryptedTokens) return false;

      const tokens = await this.cryptoManager.decrypt(authData.encryptedTokens);
      const parsedTokens: AuthTokens = JSON.parse(tokens);
      
      // Set tokens in API client for refresh
      apiClient.setAuthTokens(parsedTokens);
      
      // The API client will handle token refresh internally
      // We just need to check if it was successful
      const newAuthState = await this.getAuthState();
      return newAuthState.isAuthenticated;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Store authentication data securely
   */
  private async storeAuthData(authResponse: AuthResponse): Promise<void> {
    // Encrypt tokens
    const encryptedTokens = await this.cryptoManager.encrypt(
      JSON.stringify(authResponse.tokens)
    );
    
    const sessionExpiresAt = new Date(Date.now() + this.config.sessionTimeout);
    
    await this.authStorage.set({
      encryptedTokens,
      user: authResponse.user,
      lastLoginTime: new Date().toISOString(),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    });
  }

  /**
   * Update application state with auth data
   */
  private async updateAuthState(authResponse: AuthResponse): Promise<void> {
    stateManager.updateState({
      auth: {
        isAuthenticated: true,
        user: authResponse.user,
        tokens: authResponse.tokens,
      },
    });
  }

  /**
   * Clear stored authentication data
   */
  private async clearAuthData(): Promise<void> {
    await this.authStorage.set({});
    apiClient.clearAuthTokens();
  }

  /**
   * Create new session
   */
  private async createSession(): Promise<void> {
    const sessionId = this.generateSessionId();
    const deviceFingerprint = await this.generateDeviceFingerprint();
    
    await this.sessionStorage.set({
      sessionId,
      lastActivity: new Date().toISOString(),
      deviceFingerprint,
    });
  }

  /**
   * Clear session data
   */
  private async clearSession(): Promise<void> {
    await this.sessionStorage.set({});
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate device fingerprint for security
   */
  private async generateDeviceFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || '0',
    ];
    
    return this.cryptoManager.hash(components.join('|'));
  }

  /**
   * Check session validity
   */
  private async checkSessionValidity(): Promise<void> {
    const authState = await this.getAuthState();
    
    if (!authState.isAuthenticated) return;
    
    // Check session expiration
    if (authState.sessionExpiresAt && Date.now() >= authState.sessionExpiresAt.getTime()) {
      await this.logout();
      return;
    }
    
    // Check token expiration and refresh if needed
    if (authState.tokens) {
      const timeUntilExpiry = authState.tokens.expiresAt - Date.now();
      if (timeUntilExpiry <= this.config.tokenRefreshThreshold) {
        await this.refreshTokens();
      }
    }
    
    // Update last activity
    const sessionData = await this.sessionStorage.get();
    if (sessionData.sessionId) {
      await this.sessionStorage.set({
        ...sessionData,
        lastActivity: new Date().toISOString(),
      });
    }
  }

  /**
   * Record login attempt for security monitoring
   */
  private recordLoginAttempt(email: string, success: boolean): void {
    const attempt: LoginAttempt = {
      email,
      timestamp: new Date(),
      success,
    };
    
    this.loginAttempts.push(attempt);
    
    // Keep only recent attempts (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.loginAttempts = this.loginAttempts.filter(
      attempt => attempt.timestamp.getTime() > oneHourAgo
    );
  }

  /**
   * Check if account is locked due to failed attempts
   */
  private isAccountLocked(email: string): boolean {
    const recentFailedAttempts = this.loginAttempts.filter(
      attempt => 
        attempt.email === email && 
        !attempt.success &&
        (Date.now() - attempt.timestamp.getTime()) < this.config.lockoutDuration
    );
    
    return recentFailedAttempts.length >= this.config.maxLoginAttempts;
  }

  /**
   * Broadcast authentication status to extension components
   */
  private broadcastAuthStatus(): void {
    this.getAuthState().then(authState => {
      const message = createMessage({
        type: 'auth:status' as const,
        source: 'background' as const,
        data: {
          isAuthenticated: authState.isAuthenticated,
          user: authState.user,
        },
      });
      
      messageRouter.broadcastToExtension(message);
    });
  }

  /**
   * Get login attempt statistics
   */
  getLoginStats(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    lockedAccounts: string[];
  } {
    const totalAttempts = this.loginAttempts.length;
    const successfulAttempts = this.loginAttempts.filter(a => a.success).length;
    const failedAttempts = totalAttempts - successfulAttempts;
    
    // Get currently locked accounts
    const lockedAccounts = Array.from(new Set(
      this.loginAttempts
        .filter(attempt => !attempt.success)
        .map(attempt => attempt.email)
        .filter(email => this.isAccountLocked(email))
    ));
    
    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      lockedAccounts,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
    
    this.loginAttempts = [];
  }
}

// Export singleton instance
export const authManager = new AuthManager();