/**
 * AI Autofill Controller
 * Orchestrates the AI-powered autofill process by integrating HTML extraction,
 * AI analysis, and instruction execution with progress tracking and error handling.
 */

import type { 
  AIFormAnalysis, 
  AIAutofillResult, 
  AIAutofillProgress, 
  ExecutionResult,
  FormInstruction,
  ExtractedHTML,
  UserProfile,
  AutofillResult,
  AIError,
  AIErrorResolution
} from '@extension/shared';
import { AIPreferencesManager } from '@extension/shared';
import { htmlExtractor } from './ai/html-extractor';
import { InstructionExecutor } from './ai/instruction-executor';
import { aiFallbackManager } from './ai/ai-fallback-manager';
import { aiLearningManager } from './ai/ai-learning-manager';
import { profileStorage, aiSettingsStorage } from '@extension/storage';
import { EnhancedAutofill } from './enhanced-autofill';
import { OnDemandAutofill } from './on-demand-autofill';
import { contentAIServiceClient } from './ai/ai-service-client-content';
import { aiErrorNotificationManager } from './ai/ai-error-notification';

export interface AIAutofillControllerOptions {
  enableProgressTracking: boolean;
  enableFallback: boolean;
  fallbackTimeout: number;
  maxRetryAttempts: number;
  logExecution: boolean;
}

/**
 * Main AI autofill controller that orchestrates the entire AI autofill process
 */
export class AIAutofillController {
  private readonly options: AIAutofillControllerOptions;
  private instructionExecutor: InstructionExecutor;
  private enhancedAutofill: EnhancedAutofill | null = null;
  private onDemandAutofill: OnDemandAutofill | null = null;
  private isProcessing = false;
  private currentProgress: AIAutofillProgress | null = null;
  private progressCallbacks: Array<(progress: AIAutofillProgress) => void> = [];
  private abortController: AbortController | null = null;

  constructor(options: Partial<AIAutofillControllerOptions> = {}) {
    this.options = {
      enableProgressTracking: true,
      enableFallback: true,
      fallbackTimeout: 30000, // 30 seconds
      maxRetryAttempts: 3,
      logExecution: true,
      ...options
    };

    this.instructionExecutor = new InstructionExecutor({
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 1000,
      safetyChecks: true,
      logExecution: this.options.logExecution
    });

    this.initializeFallbackHandlers();
  }

  /**
   * Initialize fallback autofill handlers
   */
  private initializeFallbackHandlers(): void {
    if (this.options.enableFallback) {
      try {
        // Create fallback instances with button creation disabled to avoid conflicts
        this.enhancedAutofill = new EnhancedAutofill({ 
          enableButtonCreation: false,
          enableFormDetection: false 
        });
        this.onDemandAutofill = new OnDemandAutofill({ 
          enableButtonCreation: false,
          enableFormDetection: false 
        });
      } catch (error) {
        console.warn('[AIAutofillController] Failed to initialize fallback handlers:', error);
      }
    }
  }

  /**
   * Main AI autofill execution method
   */
  async performAIAutofill(container?: HTMLElement): Promise<AIAutofillResult> {
    if (this.isProcessing) {
      throw new Error('AI autofill is already in progress');
    }

    this.isProcessing = true;
    this.abortController = new AbortController();
    const startTime = performance.now();

    try {
      // Check if AI Mode is enabled
      const aiSettings = await aiSettingsStorage.get();
      
      if (!aiSettings.enabled) {
        throw new Error('AI Mode is not enabled. Please enable it in settings.');
      }

      const hasToken = await aiSettingsStorage.hasToken();
      if (!hasToken) {
        throw new Error('No OpenAI API token configured. Please add your token in settings.');
      }

      // Update progress: Starting analysis
      this.updateProgress({
        stage: 'analyzing',
        progress: 10,
        message: 'Extracting form structure...'
      });

      // Step 1: Extract HTML form structure
      const extractedHTML = await this.extractFormHTML(container);
      
      this.updateProgress({
        stage: 'analyzing',
        progress: 30,
        message: 'Analyzing form with AI...'
      });

      // Step 2: Analyze with AI
      const aiAnalysis = await this.analyzeWithAI(extractedHTML);
      
      this.updateProgress({
        stage: 'executing',
        progress: 50,
        message: `Executing ${aiAnalysis.instructions.length} instructions...`
      });

      // Step 3: Execute instructions
      const executionResults = await this.executeInstructions(aiAnalysis.instructions);

      // Step 4: Calculate results
      const result = this.calculateResults(aiAnalysis, executionResults, performance.now() - startTime);

      this.updateProgress({
        stage: 'completed',
        progress: 100,
        message: `Completed: ${result.successfulInstructions}/${result.totalInstructions} fields filled`
      });

      // Show notification for partial success if applicable
      if (result.successfulInstructions > 0 && result.failedInstructions > 0) {
        try {
          aiErrorNotificationManager.showPartialSuccessNotification(
            result.successfulInstructions,
            result.totalInstructions
          );
        } catch (notificationError) {
          console.warn('[AIAutofillController] Failed to show partial success notification:', notificationError);
        }
      }

      return result;

    } catch (error: any) {
      console.error('[AIAutofillController] AI autofill failed:', error);

      // Check if this is a configuration error that should not use fallback
      const isConfigurationError = this.isConfigurationError(error);
      
      if (isConfigurationError) {
        // Configuration errors should fail immediately without fallback
        this.updateProgress({
          stage: 'error',
          progress: 0,
          message: error.message
        });
        throw error;
      }

      // For non-configuration errors, proceed with fallback handling
      const enhancedError = this.createEnhancedError(error, 'performAIAutofill');
      const resolution = this.getErrorResolution(enhancedError);
      const userFriendlyMessage = this.getUserFriendlyMessage(enhancedError);
      
      // Check if this is a timeout error that should use fallback immediately
      const shouldUseFallbackImmediately = (error as any).isTimeout || 
                                          (error as any).canFallback !== false ||
                                          error.message?.includes('timed out');
      
      this.updateProgress({
        stage: shouldUseFallbackImmediately ? 'executing' : 'error',
        progress: shouldUseFallbackImmediately ? 60 : 0,
        message: shouldUseFallbackImmediately ? 'AI timed out, using traditional autofill...' : userFriendlyMessage.message
      });

      // Show user-friendly error notification
      try {
        await aiErrorNotificationManager.showErrorNotification(
          enhancedError,
          resolution,
          {
            operation: 'performAIAutofill',
            canRetry: userFriendlyMessage.canRetry,
            canUseFallback: userFriendlyMessage.canUseFallback,
            onRetry: async () => {
              try {
                await this.performAIAutofill(container);
              } catch (retryError) {
                console.error('[AIAutofillController] Retry failed:', retryError);
              }
            },
            onUseFallback: async () => {
              try {
                const fallbackResult = await aiFallbackManager.executeFallback(
                  enhancedError,
                  resolution,
                  {
                    operation: 'performAIAutofill',
                    url: window.location.href,
                    formData: container ? this.extractFormContext(container) : undefined
                  }
                );
                
                if (fallbackResult.success) {
                  aiErrorNotificationManager.showFallbackSuccessNotification(
                    fallbackResult.strategyUsed,
                    fallbackResult.result?.filledCount || 0
                  );
                }
              } catch (fallbackError) {
                console.error('[AIAutofillController] Manual fallback failed:', fallbackError);
              }
            },
            onOpenSettings: () => {
              // Open extension settings/options page
              if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                  type: 'open_options_page'
                });
              }
            }
          }
        );
      } catch (notificationError) {
        console.warn('[AIAutofillController] Failed to show error notification:', notificationError);
      }

      // Attempt fallback if appropriate
      const shouldAttemptFallback = resolution.action === 'fallback' || 
                                   (this.options.enableFallback && enhancedError.fallbackAvailable) ||
                                   shouldUseFallbackImmediately;
      
      if (shouldAttemptFallback) {
        try {
          console.log('[AIAutofillController] Attempting intelligent fallback...');
          
          const fallbackResult = await aiFallbackManager.executeFallback(
            enhancedError,
            resolution,
            {
              operation: 'performAIAutofill',
              url: window.location.href,
              formData: container ? this.extractFormContext(container) : undefined
            }
          );

          if (fallbackResult.success) {
            // Convert fallback result to AI autofill result format
            const aiResult = aiFallbackManager.convertToAIResult(fallbackResult, enhancedError);
            
            this.updateProgress({
              stage: 'completed',
              progress: 100,
              message: `Fallback successful: ${fallbackResult.strategyUsed} filled ${aiResult.successfulInstructions} fields`
            });

            return aiResult;
          } else {
            console.warn('[AIAutofillController] Fallback failed:', fallbackResult.error);
          }
        } catch (fallbackError: any) {
          console.error('[AIAutofillController] Fallback execution failed:', fallbackError);
        }
      }

      // If we reach here, both AI and fallback failed
      const finalError = new Error(
        userFriendlyMessage.canUseFallback 
          ? `${userFriendlyMessage.message}. Fallback strategies also failed.`
          : userFriendlyMessage.message
      );
      
      // Add user guidance to error
      (finalError as any).userGuidance = userFriendlyMessage.guidance;
      (finalError as any).preventionTips = userFriendlyMessage.preventionTips;
      (finalError as any).canRetry = userFriendlyMessage.canRetry;

      throw finalError;
    } finally {
      this.isProcessing = false;
      this.abortController = null;
    }
  }

  /**
   * Extract HTML form structure for AI analysis
   */
  async extractFormHTML(container?: HTMLElement): Promise<ExtractedHTML> {
    try {
      const extractedHTML = await htmlExtractor.extractFormHTML(container, {
        includeStyles: false,
        maxDepth: 10,
        preserveDataAttributes: true
      });

      if (this.options.logExecution) {
        console.log('[AIAutofillController] Extracted HTML:', {
          hash: extractedHTML.hash,
          metadata: extractedHTML.metadata,
          htmlLength: extractedHTML.html.length
        });
      }

      return extractedHTML;
    } catch (error: any) {
      throw new Error(`Failed to extract form HTML: ${error.message}`);
    }
  }

  /**
   * Analyze extracted HTML with AI
   */
  async analyzeWithAI(extractedHTML: ExtractedHTML): Promise<AIFormAnalysis> {
    try {
      // Get user profile for context
      const userProfile = await profileStorage.get();
      if (!userProfile) {
        throw new Error('User profile not found. Please set up your profile first.');
      }

      // Initialize AI preferences if not present
      const profileWithAI = AIPreferencesManager.initializeAIPreferences(userProfile);

      // Extract job context from page if possible
      const jobContext = this.extractJobContext(extractedHTML);

      // Check if the HTML is too large and might cause timeouts
      if (extractedHTML.html.length > 10000) {
        console.warn('[AIAutofillController] Large form detected, this may take longer to analyze');
        this.updateProgress({
          stage: 'analyzing',
          progress: 35,
          message: 'Analyzing complex form... This may take a moment.'
        });
      }

      // Analyze form with AI using enhanced profile context
      const analysis = await contentAIServiceClient.analyzeForm(extractedHTML, profileWithAI, jobContext);

      if (this.options.logExecution) {
        console.log('[AIAutofillController] AI Analysis:', {
          instructionCount: analysis.instructions.length,
          confidence: analysis.confidence,
          warnings: analysis.warnings,
          jobContext,
          htmlSize: extractedHTML.html.length
        });
      }

      // Filter instructions based on user preferences
      const filteredAnalysis = await this.filterInstructionsByPreferences(analysis, profileWithAI);

      // Validate analysis
      if (!filteredAnalysis.instructions || filteredAnalysis.instructions.length === 0) {
        throw new Error('AI analysis returned no valid instructions after filtering');
      }

      return filteredAnalysis;
    } catch (error: any) {
      // Enhanced error handling for timeout issues
      if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
        const timeoutError = new Error('AI analysis is taking too long. This may be due to a complex form or slow API response. Please try again or use traditional autofill.');
        (timeoutError as any).isTimeout = true;
        (timeoutError as any).canFallback = true;
        throw timeoutError;
      }

      // Handle other specific error types
      if (error.message?.includes('No API token') || error.message?.includes('Invalid token')) {
        const tokenError = new Error('AI Mode requires a valid OpenAI API token. Please configure your token in settings.');
        (tokenError as any).canFallback = true;
        throw tokenError;
      }

      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        const quotaError = new Error('OpenAI API quota or rate limit exceeded. Please try again later or use traditional autofill.');
        (quotaError as any).canFallback = true;
        throw quotaError;
      }

      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Execute AI-generated instructions
   */
  async executeInstructions(instructions: FormInstruction[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const totalInstructions = instructions.length;

    // Sort instructions by priority (higher priority first)
    const sortedInstructions = [...instructions].sort((a, b) => b.priority - a.priority);

    for (let i = 0; i < sortedInstructions.length; i++) {
      const instruction = sortedInstructions[i];

      // Check if operation was aborted
      if (this.abortController?.signal.aborted) {
        throw new Error('AI autofill was cancelled');
      }

      // Update progress with more detailed information
      const progressPercent = 50 + (i / totalInstructions) * 40; // 50-90% range
      const successfulSoFar = results.filter(r => r.success).length;
      const fieldDescription = this.getFieldDescription(instruction);
      
      this.updateProgress({
        stage: 'executing',
        progress: progressPercent,
        message: `Filling field: ${fieldDescription}`,
        currentInstruction: instruction,
        estimatedTimeRemaining: (totalInstructions - i) * 500,
        additionalInfo: {
          completed: i,
          total: totalInstructions,
          successful: successfulSoFar,
          failed: i - successfulSoFar
        }
      });

      try {
        const result = await this.instructionExecutor.executeInstruction(instruction);
        
        // If execution succeeded, validate the result
        if (result.success) {
          const validationResult = await this.validateInstructionResult(instruction, result);
          if (!validationResult.isValid) {
            // Mark as failed and add validation error
            result.success = false;
            result.error = `Validation failed: ${validationResult.reason}`;
            
            if (this.options.logExecution) {
              console.warn('[AIAutofillController] Instruction validation failed:', {
                instruction,
                expectedValue: instruction.value,
                actualValue: result.actualValue,
                reason: validationResult.reason
              });
            }
          }
        }
        
        results.push(result);

        // Record learning event for AI improvement
        try {
          aiLearningManager.recordLearningEvent(instruction, result, window.location.href);
        } catch (learningError) {
          console.warn('[AIAutofillController] Failed to record learning event:', learningError);
        }

        if (this.options.logExecution && !result.success) {
          console.warn('[AIAutofillController] Instruction failed:', {
            instruction,
            error: result.error
          });
        }
      } catch (error: any) {
        const failedResult: ExecutionResult = {
          instruction,
          success: false,
          error: error.message,
          executionTime: 0,
          retryCount: 0
        };
        results.push(failedResult);

        // Record learning event for failure
        try {
          aiLearningManager.recordLearningEvent(instruction, failedResult, window.location.href);
        } catch (learningError) {
          console.warn('[AIAutofillController] Failed to record learning event:', learningError);
        }
      }

      // Small delay between instructions to prevent overwhelming the page
      await this.delay(100);
    }

    return results;
  }

  /**
   * Calculate final autofill results
   */
  private calculateResults(
    aiAnalysis: AIFormAnalysis,
    executionResults: ExecutionResult[],
    totalExecutionTime: number
  ): AIAutofillResult {
    const successfulInstructions = executionResults.filter(r => r.success).length;
    const failedInstructions = executionResults.filter(r => !r.success).length;
    const errors = executionResults
      .filter(r => !r.success && r.error)
      .map(r => r.error!);

    return {
      success: successfulInstructions > 0,
      aiAnalysis,
      executionResults,
      totalInstructions: aiAnalysis.instructions.length,
      successfulInstructions,
      failedInstructions,
      totalExecutionTime,
      fallbackUsed: false,
      errors
    };
  }



  /**
   * Update progress and notify callbacks
   */
  private updateProgress(progress: AIAutofillProgress): void {
    if (!this.options.enableProgressTracking) {
      return;
    }

    this.currentProgress = progress;
    
    // Notify all progress callbacks
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('[AIAutofillController] Progress callback error:', error);
      }
    });

    if (this.options.logExecution) {
      console.log('[AIAutofillController] Progress:', progress);
    }
  }

  /**
   * Add progress callback
   */
  onProgress(callback: (progress: AIAutofillProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Remove progress callback
   */
  offProgress(callback: (progress: AIAutofillProgress) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  /**
   * Cancel ongoing AI autofill operation
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.updateProgress({
        stage: 'error',
        progress: 0,
        message: 'AI autofill cancelled by user'
      });
    }
  }

  /**
   * Check if AI autofill is currently processing
   */
  isProcessingAutofill(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current progress
   */
  getCurrentProgress(): AIAutofillProgress | null {
    return this.currentProgress;
  }

  /**
   * Get execution statistics from instruction executor
   */
  getExecutionStats() {
    return this.instructionExecutor.getExecutionStats();
  }

  /**
   * Clear execution logs
   */
  clearExecutionLogs(): void {
    this.instructionExecutor.clearExecutionLog();
  }

  /**
   * Handle AI errors with appropriate resolution strategies
   */
  async handleAIError(error: any): Promise<AIErrorResolution> {
    try {
      const enhancedError = this.createEnhancedError(error, 'handleAIError');
      return this.getErrorResolution(enhancedError);
    } catch (importError) {
      // Fallback error resolution
      return {
        action: 'fallback',
        message: 'AI service unavailable. Using traditional autofill.',
        fallbackStrategy: 'traditional_autofill'
      };
    }
  }

  /**
   * Validate that an instruction was executed successfully
   */
  private async validateInstructionResult(
    instruction: FormInstruction, 
    result: ExecutionResult
  ): Promise<{isValid: boolean, reason?: string, actualValue?: string}> {
    try {
      // Skip validation for click actions (checkboxes, buttons)
      if (instruction.action === 'click' || instruction.action === 'upload') {
        return { isValid: true };
      }

      // Find the element that was supposed to be filled
      const element = document.querySelector(instruction.selector) as HTMLElement;
      if (!element) {
        return { isValid: false, reason: 'Element no longer exists' };
      }

      // Validate based on element type
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const actualValue = element.value;
        const expectedValue = instruction.value || '';
        
        // For text fields, check if the value was set correctly
        if (actualValue !== expectedValue) {
          // Allow partial matches for long text (like cover letters)
          if (expectedValue.length > 100 && actualValue.includes(expectedValue.substring(0, 50))) {
            return { isValid: true };
          }
          return { 
            isValid: false, 
            reason: `Value mismatch: expected "${expectedValue}", got "${actualValue}"`,
            actualValue 
          };
        }
        return { isValid: true, actualValue };
      }

      if (element instanceof HTMLSelectElement) {
        const selectedOption = element.selectedOptions[0];
        const actualValue = element.value;
        const actualText = selectedOption?.textContent?.trim();
        const expectedValue = instruction.value || '';

        // Check if the correct option is selected (by value or text)
        if (actualValue !== expectedValue && actualText !== expectedValue) {
          // Try partial matching for truncated values
          if (actualText && expectedValue && 
              (actualText.toLowerCase().includes(expectedValue.toLowerCase()) ||
               expectedValue.toLowerCase().includes(actualText.toLowerCase()))) {
            return { isValid: true, actualValue: actualText };
          }
          return { 
            isValid: false, 
            reason: `Select value mismatch: expected "${expectedValue}", got value="${actualValue}" text="${actualText}"`,
            actualValue: actualText || actualValue 
          };
        }
        return { isValid: true, actualValue: actualText || actualValue };
      }

      // For other element types, assume validation passed
      return { isValid: true };
    } catch (error) {
      return { isValid: false, reason: `Validation error: ${error}` };
    }
  }

  /**
   * Extract form context for fallback operations
   */
  private extractFormContext(container?: HTMLElement): any {
    try {
      const forms = container ? 
        container.querySelectorAll('form') : 
        document.querySelectorAll('form');

      const context = {
        formCount: forms.length,
        fieldTypes: new Set<string>(),
        hasFileUploads: false,
        hasSelects: false,
        hasTextareas: false,
        totalFields: 0
      };

      forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select, textarea');
        context.totalFields += inputs.length;

        inputs.forEach(input => {
          const tagName = input.tagName.toLowerCase();
          context.fieldTypes.add(tagName);

          if (tagName === 'input') {
            const type = (input as HTMLInputElement).type;
            context.fieldTypes.add(`input[${type}]`);
            if (type === 'file') {
              context.hasFileUploads = true;
            }
          } else if (tagName === 'select') {
            context.hasSelects = true;
          } else if (tagName === 'textarea') {
            context.hasTextareas = true;
          }
        });
      });

      return {
        ...context,
        fieldTypes: Array.from(context.fieldTypes),
        url: window.location.href,
        title: document.title
      };
    } catch (error) {
      console.warn('[AIAutofillController] Failed to extract form context:', error);
      return {
        url: window.location.href,
        title: document.title,
        error: 'Failed to extract form context'
      };
    }
  }

  /**
   * Get a user-friendly description of the field being filled
   */
  private getFieldDescription(instruction: FormInstruction): string {
    // Try to extract a meaningful field name from the selector
    const selector = instruction.selector;
    
    // Common patterns to extract field names
    const patterns = [
      /name=["']([^"']+)["']/,
      /id=["']([^"']+)["']/,
      /#([a-zA-Z][\w-]*)/,
      /\[([a-zA-Z][\w-]*)\]/
    ];
    
    for (const pattern of patterns) {
      const match = selector.match(pattern);
      if (match) {
        const fieldName = match[1];
        // Convert field names to readable format
        return fieldName
          .replace(/_/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .toLowerCase()
          .replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    
    // Fallback to action description
    switch (instruction.action) {
      case 'fill':
        return 'text field';
      case 'select':
        return 'dropdown menu';
      case 'click':
        return 'checkbox/button';
      case 'upload':
        return 'file upload';
      default:
        return 'form field';
    }
  }



  /**
   * Extract job context from page content
   */
  private extractJobContext(extractedHTML: ExtractedHTML): { company?: string; role?: string; industry?: string } | undefined {
    try {
      const url = extractedHTML.metadata.url;
      const pageTitle = extractedHTML.metadata.pageTitle;
      const html = extractedHTML.html;

      const context: { company?: string; role?: string; industry?: string } = {};

      // Extract company name from URL or title
      const urlParts = new URL(url).hostname.split('.');
      if (urlParts.length >= 2) {
        context.company = urlParts[urlParts.length - 2]; // Get domain name without TLD
      }

      // Extract role from page title
      const rolePatterns = [
        /(?:apply for|position:|role:)\s*([^-|]+)/i,
        /([^-|]+)\s*(?:at|@)\s*[^-|]+/i,
        /job:\s*([^-|]+)/i
      ];

      for (const pattern of rolePatterns) {
        const match = pageTitle.match(pattern);
        if (match) {
          context.role = match[1].trim();
          break;
        }
      }

      // Extract industry hints from content
      const industryKeywords = {
        'technology': ['software', 'tech', 'engineering', 'developer', 'programmer'],
        'finance': ['finance', 'banking', 'investment', 'financial'],
        'healthcare': ['healthcare', 'medical', 'hospital', 'clinic'],
        'education': ['education', 'school', 'university', 'teaching'],
        'retail': ['retail', 'sales', 'customer service', 'store'],
      };

      const contentLower = (pageTitle + ' ' + html.substring(0, 1000)).toLowerCase();
      for (const [industry, keywords] of Object.entries(industryKeywords)) {
        if (keywords.some(keyword => contentLower.includes(keyword))) {
          context.industry = industry;
          break;
        }
      }

      return Object.keys(context).length > 0 ? context : undefined;
    } catch (error) {
      console.warn('[AIAutofillController] Failed to extract job context:', error);
      return undefined;
    }
  }

  /**
   * Filter AI instructions based on user preferences
   */
  private async filterInstructionsByPreferences(
    analysis: AIFormAnalysis,
    userProfile: UserProfile
  ): Promise<AIFormAnalysis> {
    const preferences = userProfile.preferences?.aiPreferences || AIPreferencesManager.getDefaultPreferences();

    // Filter out excluded fields
    const filteredInstructions = analysis.instructions.filter(instruction => {
      // Check if field should be excluded
      const fieldName = this.extractFieldNameFromSelector(instruction.selector) || '';
      const isExcluded = AIPreferencesManager.isFieldExcluded(userProfile, fieldName, instruction.selector);
      
      if (isExcluded) {
        console.log('[AIAutofillController] Excluding field:', fieldName, instruction.selector);
        return false;
      }

      // Check confidence threshold
      if (instruction.confidence < preferences.confidenceThreshold) {
        console.log('[AIAutofillController] Excluding low confidence instruction:', instruction.confidence, instruction.selector);
        return false;
      }

      return true;
    });

    // Limit number of instructions
    const limitedInstructions = filteredInstructions.slice(0, preferences.maxInstructionsPerForm);

    // Add warnings for filtered instructions
    const warnings = [...analysis.warnings];
    if (filteredInstructions.length < analysis.instructions.length) {
      warnings.push(`${analysis.instructions.length - filteredInstructions.length} instructions filtered by user preferences`);
    }
    if (limitedInstructions.length < filteredInstructions.length) {
      warnings.push(`Limited to ${preferences.maxInstructionsPerForm} instructions per form`);
    }

    return {
      ...analysis,
      instructions: limitedInstructions,
      warnings
    };
  }

  /**
   * Extract field name from CSS selector
   */
  private extractFieldNameFromSelector(selector: string): string | null {
    const patterns = [
      /name=["']([^"']+)["']/,
      /id=["']([^"']+)["']/,
      /#([a-zA-Z][\w-]*)/,
      /\.([a-zA-Z][\w-]*)/,
      /\[name=["']([^"']+)["']\]/,
    ];

    for (const pattern of patterns) {
      const match = selector.match(pattern);
      if (match) return match[1];
    }

    return null;
  }



  /**
   * Record user feedback on AI performance
   */
  recordFeedback(
    rating: 1 | 2 | 3 | 4 | 5,
    comment?: string,
    analysisId?: string
  ): void {
    try {
      aiLearningManager.recordFeedback(
        rating,
        comment,
        analysisId || 'unknown',
        window.location.href
      );
    } catch (error) {
      console.warn('[AIAutofillController] Failed to record feedback:', error);
    }
  }

  /**
   * Record user correction for learning
   */
  recordUserCorrection(
    originalInstruction: FormInstruction,
    correctedValue: string
  ): void {
    try {
      aiLearningManager.recordUserCorrection(
        originalInstruction,
        correctedValue,
        window.location.href
      );
    } catch (error) {
      console.warn('[AIAutofillController] Failed to record user correction:', error);
    }
  }

  /**
   * Get learning insights for analytics
   */
  getLearningInsights() {
    return aiLearningManager.getLearningInsights();
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions() {
    return aiLearningManager.getOptimizationSuggestions();
  }

  /**
   * Export learning data
   */
  exportLearningData() {
    return aiLearningManager.exportLearningData();
  }

  /**
   * Clear learning data
   */
  clearLearningData(): void {
    aiLearningManager.clearLearningData();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.cancel();
    this.progressCallbacks = [];
    this.currentProgress = null;
    if (this.instructionExecutor) {
      if (typeof this.instructionExecutor.clearExecutionLog === 'function') {
        this.instructionExecutor.clearExecutionLog();
      }
      if (typeof this.instructionExecutor.dispose === 'function') {
        this.instructionExecutor.dispose();
      }
    }
  }

  /**
   * Check if error is a configuration error that should not use fallback
   */
  private isConfigurationError(error: Error): boolean {
    const message = error.message?.toLowerCase() || '';
    
    // Configuration errors that should fail immediately
    const configurationErrorPatterns = [
      'ai mode is not enabled',
      'no openai api token configured',
      'user profile not found',
      'failed to extract form html',
      'ai analysis failed',
      'ai analysis returned no'
    ];
    
    return configurationErrorPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Create enhanced error locally to avoid cross-package imports
   */
  private createEnhancedError(error: Error, operation: string): any {
    const message = error.message?.toLowerCase() || '';
    let errorType: string;
    let severity: 'low' | 'medium' | 'high' | 'critical';
    let recoverable = true;
    let userActionRequired = false;
    let fallbackAvailable = true;

    // Classify error type based on message content
    if (message.includes('token') && (message.includes('invalid') || message.includes('unauthorized'))) {
      errorType = 'INVALID_TOKEN';
      severity = 'high';
      userActionRequired = true;
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      errorType = 'API_RATE_LIMIT';
      severity = 'medium';
    } else if (message.includes('quota') || message.includes('billing')) {
      errorType = 'API_QUOTA_EXCEEDED';
      severity = 'high';
      userActionRequired = true;
    } else if (message.includes('network') || message.includes('timeout')) {
      errorType = 'NETWORK_ERROR';
      severity = 'medium';
    } else if (message.includes('parse') || message.includes('json')) {
      errorType = 'PARSING_ERROR';
      severity = 'low';
      recoverable = false;
    } else {
      errorType = 'EXECUTION_FAILED';
      severity = 'medium';
      recoverable = false;
    }

    return {
      ...error,
      type: errorType,
      context: {
        operation,
        timestamp: new Date(),
        retryCount: 0,
        url: window.location.href,
      },
      severity,
      recoverable,
      userActionRequired,
      fallbackAvailable,
    };
  }

  /**
   * Get error resolution strategy locally
   */
  private getErrorResolution(error: any): AIErrorResolution {
    const resolutions: Record<string, AIErrorResolution> = {
      INVALID_TOKEN: {
        action: 'user_action_required',
        message: 'Your OpenAI API token is invalid or expired',
      },
      API_RATE_LIMIT: {
        action: 'retry',
        message: 'OpenAI API rate limit exceeded. Retrying with backoff...',
        fallbackStrategy: 'traditional_autofill',
      },
      API_QUOTA_EXCEEDED: {
        action: 'user_action_required',
        message: 'OpenAI API quota exceeded. Please check your billing settings',
      },
      NETWORK_ERROR: {
        action: 'retry',
        message: 'Network connection error. Retrying...',
        fallbackStrategy: 'traditional_autofill',
      },
      PARSING_ERROR: {
        action: 'fallback',
        message: 'Failed to parse AI response. Using traditional autofill',
        fallbackStrategy: 'traditional_autofill',
      },
      EXECUTION_FAILED: {
        action: 'fallback',
        message: 'AI instruction execution failed. Trying traditional autofill',
        fallbackStrategy: 'traditional_autofill',
      },
    };

    return resolutions[error.type] || {
      action: 'fallback',
      message: 'An error occurred. Using traditional autofill',
      fallbackStrategy: 'traditional_autofill',
    };
  }

  /**
   * Get user-friendly error message locally
   */
  private getUserFriendlyMessage(error: any): {
    title: string;
    message: string;
    guidance: string[];
    preventionTips: string[];
    canRetry: boolean;
    canUseFallback: boolean;
  } {
    const titles: Record<string, string> = {
      INVALID_TOKEN: 'Invalid API Token',
      API_RATE_LIMIT: 'Rate Limit Exceeded',
      API_QUOTA_EXCEEDED: 'API Quota Exceeded',
      NETWORK_ERROR: 'Network Connection Error',
      PARSING_ERROR: 'Response Parsing Error',
      EXECUTION_FAILED: 'Execution Failed',
    };

    const messages: Record<string, string> = {
      INVALID_TOKEN: 'Your OpenAI API token is invalid or expired',
      API_RATE_LIMIT: 'OpenAI API rate limit exceeded. Retrying with backoff...',
      API_QUOTA_EXCEEDED: 'OpenAI API quota exceeded. Please check your billing settings',
      NETWORK_ERROR: 'Network connection error. Retrying...',
      PARSING_ERROR: 'Failed to parse AI response. Using traditional autofill',
      EXECUTION_FAILED: 'AI instruction execution failed. Trying traditional autofill',
    };

    return {
      title: titles[error.type] || 'AI Error',
      message: messages[error.type] || error.message,
      guidance: [],
      preventionTips: [],
      canRetry: error.recoverable,
      canUseFallback: error.fallbackAvailable,
    };
  }
}

// Export singleton instance for use across the content script
export const aiAutofillController = new AIAutofillController();

// Make available globally for verification and debugging
(window as any).aiAutofillController = aiAutofillController;