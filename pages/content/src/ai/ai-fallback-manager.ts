/**
 * AI Fallback Manager
 * Handles fallback strategies when AI autofill fails
 */

import type { AIAutofillResult, AIErrorResolution } from '@extension/shared';

export interface FallbackResult {
  success: boolean;
  strategyUsed: string;
  result?: {
    filledCount: number;
    errors?: string[];
  };
  error?: string;
}

export interface FallbackContext {
  operation: string;
  url: string;
  formData?: any;
}

/**
 * AI Fallback Manager implementation
 */
export class AIFallbackManager {
  
  /**
   * Execute fallback strategy based on error and resolution
   */
  async executeFallback(
    error: any,
    resolution: AIErrorResolution,
    context: FallbackContext
  ): Promise<FallbackResult> {
    try {
      console.log('[AIFallbackManager] Executing fallback strategy:', resolution.fallbackStrategy);

      switch (resolution.fallbackStrategy) {
        case 'traditional_autofill':
          return await this.executeTraditionalAutofill(context);
        
        case 'manual_mode':
          return await this.executeManualMode(context);
        
        default:
          return {
            success: false,
            strategyUsed: 'none',
            error: 'No fallback strategy available'
          };
      }
    } catch (fallbackError: any) {
      console.error('[AIFallbackManager] Fallback execution failed:', fallbackError);
      return {
        success: false,
        strategyUsed: resolution.fallbackStrategy || 'unknown',
        error: fallbackError.message
      };
    }
  }

  /**
   * Execute traditional autofill as fallback
   */
  private async executeTraditionalAutofill(context: FallbackContext): Promise<FallbackResult> {
    try {
      // Try to get enhanced autofill from global scope
      const enhancedAutofill = (window as any).enhancedAutofill;
      const onDemandAutofill = (window as any).onDemandAutofill;

      let result;
      let strategyUsed = 'traditional_autofill';

      if (enhancedAutofill && typeof enhancedAutofill.handleAutofillTrigger === 'function') {
        result = await enhancedAutofill.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'ai-fallback',
          data: { tabId: 0 }
        });
        strategyUsed = 'enhanced_autofill';
      } else if (onDemandAutofill && typeof onDemandAutofill.handleAutofillTrigger === 'function') {
        result = await onDemandAutofill.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'ai-fallback',
          data: { tabId: 0 }
        });
        strategyUsed = 'on_demand_autofill';
      } else {
        throw new Error('No traditional autofill system available');
      }

      return {
        success: true,
        strategyUsed,
        result: {
          filledCount: result?.filledCount || 0,
          errors: result?.errors || []
        }
      };
    } catch (error: any) {
      return {
        success: false,
        strategyUsed: 'traditional_autofill',
        error: error.message
      };
    }
  }

  /**
   * Execute manual mode as fallback
   */
  private async executeManualMode(context: FallbackContext): Promise<FallbackResult> {
    // Manual mode just shows a message to the user
    return {
      success: true,
      strategyUsed: 'manual_mode',
      result: {
        filledCount: 0,
        errors: ['Please fill the form manually']
      }
    };
  }

  /**
   * Convert fallback result to AI autofill result format
   */
  convertToAIResult(fallbackResult: FallbackResult, originalError: any): AIAutofillResult {
    return {
      success: fallbackResult.success,
      aiAnalysis: {
        instructions: [],
        confidence: 0,
        reasoning: `Fallback strategy used: ${fallbackResult.strategyUsed}`,
        warnings: [`Original AI error: ${originalError.message}`],
        metadata: {
          analysisId: 'fallback-' + Date.now(),
          timestamp: new Date(),
          model: 'fallback',
          tokensUsed: 0
        }
      },
      executionResults: [],
      totalInstructions: 0,
      successfulInstructions: fallbackResult.result?.filledCount || 0,
      failedInstructions: 0,
      totalExecutionTime: 0,
      fallbackUsed: true,
      errors: fallbackResult.result?.errors || []
    };
  }
}

// Export singleton instance
export const aiFallbackManager = new AIFallbackManager();