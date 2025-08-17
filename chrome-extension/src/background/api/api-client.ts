/**
 * REST API client with authentication handling for job autofill extension
 */

import type { UserProfile } from '@extension/shared';

// API configuration
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// Default API configuration
const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: process.env.API_BASE_URL || 'https://api.jobautofill.com',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  tokens: AuthTokens;
}

// Request queue item
interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
  timestamp: number;
}

// API client class
export class ApiClient {
  private config: ApiConfig;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private authTokens: AuthTokens | null = null;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set authentication tokens
   */
  setAuthTokens(tokens: AuthTokens): void {
    this.authTokens = tokens;
  }

  /**
   * Clear authentication tokens
   */
  clearAuthTokens(): void {
    this.authTokens = null;
  }

  /**
   * Check if tokens are expired
   */
  private isTokenExpired(): boolean {
    if (!this.authTokens) return true;
    return Date.now() >= this.authTokens.expiresAt;
  }

  /**
   * Refresh authentication tokens
   */
  private async refreshTokens(): Promise<boolean> {
    if (!this.authTokens?.refreshToken) return false;

    try {
      const response = await this.makeRequest('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.authTokens.refreshToken }),
        headers: { 'Content-Type': 'application/json' },
      }, false); // Don't use auth for refresh request

      if (response.success && response.data) {
        this.authTokens = response.data.tokens;
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  /**
   * Make authenticated request with retry logic
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    useAuth = true
  ): Promise<ApiResponse<T>> {
    // Check and refresh tokens if needed
    if (useAuth && this.isTokenExpired()) {
      const refreshed = await this.refreshTokens();
      if (!refreshed) {
        throw new Error('Authentication required');
      }
    }

    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const queuedRequest: QueuedRequest = {
        id: requestId,
        url: endpoint,
        options: {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
            ...(useAuth && this.authTokens ? {
              'Authorization': `Bearer ${this.authTokens.accessToken}`
            } : {}),
          },
        },
        resolve,
        reject,
        retryCount: 0,
        timestamp: Date.now(),
      };

      this.requestQueue.push(queuedRequest);
      this.processQueue();
    });
  }

  /**
   * Process request queue with retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!;
      
      try {
        const response = await this.makeRequest(request.url, request.options);
        request.resolve(response);
      } catch (error) {
        // Retry logic
        if (request.retryCount < this.config.retryAttempts) {
          request.retryCount++;
          
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, request.retryCount - 1);
          
          setTimeout(() => {
            this.requestQueue.unshift(request); // Add back to front of queue
            this.processQueue();
          }, delay);
          
          continue;
        }

        request.reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Make HTTP request
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit,
    useAuth = true
  ): Promise<ApiResponse> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw new Error(error.message || 'Network error');
    }
  }

  // Authentication methods
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);

    if (response.success && response.data) {
      this.setAuthTokens(response.data.tokens);
      return response.data;
    }

    throw new Error(response.error || 'Login failed');
  }

  async register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    }, false);

    if (response.success && response.data) {
      this.setAuthTokens(response.data.tokens);
      return response.data;
    }

    throw new Error(response.error || 'Registration failed');
  }

  async logout(): Promise<void> {
    if (this.authTokens) {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch (error) {
        console.warn('Logout request failed:', error);
      }
    }
    
    this.clearAuthTokens();
  }

  // Profile methods
  async getProfile(): Promise<UserProfile> {
    const response = await this.request<UserProfile>('/profile');
    
    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error || 'Failed to fetch profile');
  }

  async updateProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const response = await this.request<UserProfile>('/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error || 'Failed to update profile');
  }

  async deleteProfile(): Promise<void> {
    const response = await this.request('/profile', { method: 'DELETE' });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete profile');
    }
  }

  // Document methods
  async uploadResume(file: File): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await this.request<{ id: string; url: string }>('/documents/resume', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error || 'Failed to upload resume');
  }

  async deleteDocument(documentId: string): Promise<void> {
    const response = await this.request(`/documents/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete document');
    }
  }

  // AI content methods
  async generateContent(request: {
    type: 'cover_letter' | 'question_response' | 'summary';
    context: any;
    preferences: any;
  }): Promise<{ content: string; confidence: number }> {
    const response = await this.request<{ content: string; confidence: number }>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error || 'Failed to generate content');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('/health', {}, false);
      return response.success;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();