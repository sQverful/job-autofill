/**
 * AI Service Client for Content Scripts
 * Communicates with background script AI service via message passing
 */

import type {
  AIFormAnalysis,
  ExtractedHTML,
  UserProfile,
  JobContext,
  AITokenValidationResult
} from '@extension/shared';

export interface ContentAIServiceClient {
  analyzeForm(htmlContent: ExtractedHTML, userProfile: UserProfile, jobContext?: JobContext): Promise<AIFormAnalysis>;
  validateToken(token?: string): Promise<AITokenValidationResult>;
  getCachedAnalysis(htmlHash: string): Promise<AIFormAnalysis | null>;
  setCachedAnalysis(htmlHash: string, analysis: AIFormAnalysis): Promise<void>;
}

/**
 * AI Service Client implementation for content scripts
 * Uses chrome.runtime.sendMessage to communicate with background script
 */
export class ContentAIServiceClientImpl implements ContentAIServiceClient {

  /**
   * Analyze form using background AI service
   */
  async analyzeForm(
    htmlContent: ExtractedHTML,
    userProfile: UserProfile,
    jobContext?: JobContext
  ): Promise<AIFormAnalysis> {
    try {
      console.log('[ContentAIServiceClient] Starting AI form analysis...');

      // First, try to get cached analysis
      const cachedAnalysis = await this.getCachedAnalysis(htmlContent.hash);
      if (cachedAnalysis) {
        console.log('[ContentAIServiceClient] Using cached AI analysis');
        return cachedAnalysis;
      }

      // Progressive timeout strategy: try with shorter timeout first, then longer
      const formComplexity = htmlContent.metadata.estimatedComplexity;
      const fieldCount = htmlContent.metadata.fieldCount;
      const htmlSize = htmlContent.html.length;
      
      const isComplexForm = formComplexity === 'high' || fieldCount > 20 || htmlSize > 8000;
      const timeouts = isComplexForm ? [25000, 45000] : [20000, 35000]; // Progressive timeouts
      
      let lastError: any;
      
      for (let attempt = 0; attempt < timeouts.length; attempt++) {
        try {
          const timeout = timeouts[attempt];
          
          if (attempt > 0) {
            console.log(`[ContentAIServiceClient] Retrying with extended timeout (${timeout}ms)...`);
          }

          const response = await this.sendMessage({
            type: 'ai:analyze-form',
            data: {
              htmlContent,
              userProfile,
              jobContext
            }
          }, timeout);

          if (!response.success) {
            const error = new Error(response.error || 'AI analysis failed');

            // Add additional error context from background script
            if (response.originalError) {
              (error as any).originalError = response.originalError;
            }
            if (response.canFallback !== undefined) {
              (error as any).canFallback = response.canFallback;
            }
            if (response.timeout) {
              (error as any).isTimeout = true;
            }

            throw error;
          }

          console.log('[ContentAIServiceClient] AI form analysis completed successfully');
          
          // Cache the successful analysis
          try {
            await this.setCachedAnalysis(htmlContent.hash, response.data);
          } catch (cacheError) {
            console.warn('[ContentAIServiceClient] Failed to cache analysis:', cacheError);
          }

          return response.data;
          
        } catch (error: any) {
          lastError = error;
          
          // If it's not a timeout error, don't retry
          if (!error.message?.includes('timed out')) {
            break;
          }
          
          // If this was the last attempt, break
          if (attempt === timeouts.length - 1) {
            break;
          }
          
          console.warn(`[ContentAIServiceClient] Attempt ${attempt + 1} timed out, retrying...`);
        }
      }
      
      // If we get here, all attempts failed
      throw lastError;
    } catch (error: any) {
      console.error('[ContentAIServiceClient] AI analysis failed:', error);

      // Enhance error message for better user experience
      let enhancedMessage = error.message;

      if (error.message?.includes('timed out')) {
        enhancedMessage = 'AI analysis timed out. Please try again or use traditional autofill.';
      } else if (error.message?.includes('Chrome runtime error')) {
        enhancedMessage = 'Communication error with extension background service. Please try refreshing the page.';
      } else if (error.message?.includes('No response from background')) {
        enhancedMessage = 'Extension background service is not responding. Please try reloading the extension.';
      } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        enhancedMessage = 'OpenAI API quota or rate limit exceeded. Please try again later.';
      } else if (error.message?.includes('token') || error.message?.includes('authentication')) {
        enhancedMessage = 'OpenAI API token issue. Please check your token in settings.';
      }

      const enhancedError = new Error(enhancedMessage);

      // Preserve additional error properties
      if (error.canFallback !== undefined) {
        (enhancedError as any).canFallback = error.canFallback;
      }
      if (error.isTimeout || error.message?.includes('timed out')) {
        (enhancedError as any).isTimeout = true;
        (enhancedError as any).canFallback = true;
      }

      // For timeout errors, always allow fallback
      if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
        (enhancedError as any).canFallback = true;
      }

      throw enhancedError;
    }
  }

  /**
   * Validate API token using background service
   */
  async validateToken(token?: string): Promise<AITokenValidationResult> {
    try {
      const response = await this.sendMessage({
        type: 'ai:validate-token',
        data: { token }
      });

      if (!response.success) {
        return {
          isValid: false,
          error: response.error || 'Token validation failed'
        };
      }

      return response.data;
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Get cached analysis from background service
   */
  async getCachedAnalysis(htmlHash: string): Promise<AIFormAnalysis | null> {
    try {
      const response = await this.sendMessage({
        type: 'ai:get-cached-analysis',
        data: { htmlHash }
      });

      return response.success ? response.data : null;
    } catch (error) {
      console.warn('[ContentAIServiceClient] Failed to get cached analysis:', error);
      return null;
    }
  }

  /**
   * Set cached analysis in background service
   */
  async setCachedAnalysis(htmlHash: string, analysis: AIFormAnalysis): Promise<void> {
    try {
      await this.sendMessage({
        type: 'ai:set-cached-analysis',
        data: { htmlHash, analysis }
      });
    } catch (error) {
      console.warn('[ContentAIServiceClient] Failed to set cached analysis:', error);
    }
  }

  /**
   * Send message to background script and wait for response
   */
  private async sendMessage(message: any, timeoutMs: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime?.sendMessage) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      let responseReceived = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true;
          reject(new Error(`Request timed out after ${timeoutMs}ms. The AI service may be overloaded or your internet connection may be slow.`));
        }
      }, timeoutMs);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);

          if (responseReceived) {
            return; // Already handled by timeout
          }

          responseReceived = true;

          if (chrome.runtime.lastError) {
            reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
            return;
          }

          if (!response) {
            reject(new Error('No response from background script. The background service may have crashed.'));
            return;
          }

          resolve(response);
        });
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (!responseReceived) {
          responseReceived = true;
          reject(new Error(`Failed to send message: ${error.message}`));
        }
      }
    });
  }
}

// Export singleton instance
export const contentAIServiceClient = new ContentAIServiceClientImpl();