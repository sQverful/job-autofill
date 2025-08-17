/**
 * Change Detector
 * Detects and tracks changes in form fields and DOM structure
 */

import type { FormChangeEvent, MonitoredForm } from './form-monitor.js';

export interface ChangePattern {
  type: 'field_value' | 'field_visibility' | 'form_structure' | 'validation_state';
  pattern: string;
  frequency: number;
  lastSeen: Date;
  confidence: number;
}

export interface ChangeAnalysis {
  formId: string;
  changeType: string;
  patterns: ChangePattern[];
  predictions: {
    nextChange?: string;
    timeToNext?: number;
    confidence: number;
  };
  recommendations: string[];
}

/**
 * Detects and analyzes form changes for better autofill timing
 */
export class ChangeDetector {
  private changeHistory = new Map<string, FormChangeEvent[]>();
  private patterns = new Map<string, ChangePattern[]>();
  private analysisCache = new Map<string, ChangeAnalysis>();
  private maxHistorySize = 100;
  private patternThreshold = 3;

  constructor() {
    this.setupCleanupInterval();
  }

  /**
   * Record a form change event
   */
  recordChange(event: FormChangeEvent): void {
    const key = `${event.formId}-${event.type}`;
    
    // Add to history
    if (!this.changeHistory.has(key)) {
      this.changeHistory.set(key, []);
    }
    
    const history = this.changeHistory.get(key)!;
    history.push(event);
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    // Update patterns
    this.updatePatterns(event);
    
    // Clear analysis cache for this form
    this.analysisCache.delete(event.formId);

    console.log(`Recorded change: ${event.type} for form ${event.formId}`);
  }

  /**
   * Analyze changes for a form
   */
  analyzeChanges(formId: string): ChangeAnalysis {
    // Check cache first
    const cached = this.analysisCache.get(formId);
    if (cached) {
      return cached;
    }

    const analysis = this.performChangeAnalysis(formId);
    this.analysisCache.set(formId, analysis);
    
    return analysis;
  }

  /**
   * Detect change patterns
   */
  detectPatterns(formId: string): ChangePattern[] {
    const formPatterns: ChangePattern[] = [];
    
    for (const [key, patterns] of this.patterns.entries()) {
      if (key.startsWith(formId)) {
        formPatterns.push(...patterns);
      }
    }

    return formPatterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Predict next change
   */
  predictNextChange(formId: string): { type: string; confidence: number; timeEstimate?: number } | null {
    const patterns = this.detectPatterns(formId);
    
    if (patterns.length === 0) {
      return null;
    }

    // Find the most confident pattern
    const topPattern = patterns[0];
    
    if (topPattern.confidence < 0.6) {
      return null;
    }

    // Estimate time to next change based on historical frequency
    const avgInterval = this.calculateAverageInterval(formId, topPattern.type);
    
    return {
      type: topPattern.type,
      confidence: topPattern.confidence,
      timeEstimate: avgInterval,
    };
  }

  /**
   * Check if form is ready for autofill
   */
  isReadyForAutofill(formId: string, form: MonitoredForm): boolean {
    const analysis = this.analyzeChanges(formId);
    
    // Check if form is stable (no recent rapid changes)
    const recentChanges = this.getRecentChanges(formId, 2000); // Last 2 seconds
    if (recentChanges.length > 5) {
      console.log(`Form ${formId} not ready: too many recent changes (${recentChanges.length})`);
      return false;
    }

    // Check if form structure is stable
    const structureChanges = recentChanges.filter(change => 
      change.type === 'form_added' || 
      change.type === 'field_added' || 
      change.type === 'field_removed'
    );
    
    if (structureChanges.length > 0) {
      console.log(`Form ${formId} not ready: recent structure changes`);
      return false;
    }

    // Check if form is visible and interactive
    if (!this.isFormVisible(form.element)) {
      console.log(`Form ${formId} not ready: not visible`);
      return false;
    }

    // Check if form fields are ready
    const readyFields = this.countReadyFields(form);
    const totalFields = form.fields.size;
    
    if (readyFields / totalFields < 0.8) {
      console.log(`Form ${formId} not ready: only ${readyFields}/${totalFields} fields ready`);
      return false;
    }

    console.log(`Form ${formId} is ready for autofill`);
    return true;
  }

  /**
   * Get optimal autofill timing
   */
  getOptimalAutofillTiming(formId: string): {
    delay: number;
    reason: string;
    confidence: number;
  } {
    const analysis = this.analyzeChanges(formId);
    const prediction = this.predictNextChange(formId);
    
    // Default timing
    let delay = 500;
    let reason = 'Default delay for form stability';
    let confidence = 0.5;

    // Adjust based on change patterns
    if (prediction) {
      if (prediction.type === 'field_visibility' && prediction.timeEstimate) {
        // Wait for field visibility changes to complete
        delay = Math.min(prediction.timeEstimate + 200, 2000);
        reason = 'Waiting for field visibility changes';
        confidence = prediction.confidence;
      } else if (prediction.type === 'form_structure' && prediction.timeEstimate) {
        // Wait for structure changes to complete
        delay = Math.min(prediction.timeEstimate + 500, 3000);
        reason = 'Waiting for form structure changes';
        confidence = prediction.confidence;
      }
    }

    // Adjust based on recent activity
    const recentChanges = this.getRecentChanges(formId, 5000);
    if (recentChanges.length > 10) {
      delay = Math.max(delay, 1000);
      reason = 'High change activity detected';
      confidence = Math.max(confidence, 0.7);
    }

    return { delay, reason, confidence };
  }

  /**
   * Get change statistics for a form
   */
  getChangeStats(formId: string): {
    totalChanges: number;
    changesByType: Record<string, number>;
    averageInterval: number;
    lastChange?: Date;
    mostActiveField?: string;
  } {
    const allChanges = this.getAllChanges(formId);
    const changesByType: Record<string, number> = {};
    const fieldActivity: Record<string, number> = {};
    
    let totalChanges = 0;
    let lastChange: Date | undefined;
    let totalInterval = 0;
    let intervalCount = 0;

    for (const changes of allChanges.values()) {
      for (let i = 0; i < changes.length; i++) {
        const change = changes[i];
        totalChanges++;
        
        // Count by type
        changesByType[change.type] = (changesByType[change.type] || 0) + 1;
        
        // Track field activity
        if (change.fieldId) {
          fieldActivity[change.fieldId] = (fieldActivity[change.fieldId] || 0) + 1;
        }
        
        // Track timing
        if (!lastChange || change.timestamp > lastChange) {
          lastChange = change.timestamp;
        }
        
        // Calculate intervals
        if (i > 0) {
          const interval = change.timestamp.getTime() - changes[i - 1].timestamp.getTime();
          totalInterval += interval;
          intervalCount++;
        }
      }
    }

    // Find most active field
    let mostActiveField: string | undefined;
    let maxActivity = 0;
    for (const [fieldId, activity] of Object.entries(fieldActivity)) {
      if (activity > maxActivity) {
        maxActivity = activity;
        mostActiveField = fieldId;
      }
    }

    return {
      totalChanges,
      changesByType,
      averageInterval: intervalCount > 0 ? totalInterval / intervalCount : 0,
      lastChange,
      mostActiveField,
    };
  }

  /**
   * Clear change history for a form
   */
  clearHistory(formId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.changeHistory.keys()) {
      if (key.startsWith(formId)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.changeHistory.delete(key);
    }
    
    // Clear patterns
    for (const key of this.patterns.keys()) {
      if (key.startsWith(formId)) {
        this.patterns.delete(key);
      }
    }
    
    // Clear analysis cache
    this.analysisCache.delete(formId);
    
    console.log(`Cleared change history for form ${formId}`);
  }

  /**
   * Update change patterns
   */
  private updatePatterns(event: FormChangeEvent): void {
    const key = `${event.formId}-${event.type}`;
    
    if (!this.patterns.has(key)) {
      this.patterns.set(key, []);
    }
    
    const patterns = this.patterns.get(key)!;
    
    // Create pattern signature
    const signature = this.createPatternSignature(event);
    
    // Find existing pattern or create new one
    let pattern = patterns.find(p => p.pattern === signature);
    
    if (pattern) {
      pattern.frequency++;
      pattern.lastSeen = event.timestamp;
      pattern.confidence = Math.min(pattern.frequency / this.patternThreshold, 1.0);
    } else {
      pattern = {
        type: this.getPatternType(event),
        pattern: signature,
        frequency: 1,
        lastSeen: event.timestamp,
        confidence: 1 / this.patternThreshold,
      };
      patterns.push(pattern);
    }
    
    // Clean up old patterns
    this.cleanupPatterns(key);
  }

  /**
   * Create pattern signature from event
   */
  private createPatternSignature(event: FormChangeEvent): string {
    const parts = [event.type];
    
    if (event.fieldId) {
      parts.push(event.fieldId);
    }
    
    if (event.newValue !== undefined) {
      parts.push(typeof event.newValue);
    }
    
    return parts.join(':');
  }

  /**
   * Get pattern type from event
   */
  private getPatternType(event: FormChangeEvent): ChangePattern['type'] {
    switch (event.type) {
      case 'field_changed':
        return 'field_value';
      case 'field_added':
      case 'field_removed':
      case 'form_added':
      case 'form_removed':
        return 'form_structure';
      case 'validation_changed':
        return 'validation_state';
      default:
        return 'field_visibility';
    }
  }

  /**
   * Perform change analysis
   */
  private performChangeAnalysis(formId: string): ChangeAnalysis {
    const patterns = this.detectPatterns(formId);
    const stats = this.getChangeStats(formId);
    const prediction = this.predictNextChange(formId);
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on patterns
    if (stats.totalChanges > 50) {
      recommendations.push('Form shows high activity - consider delayed autofill');
    }
    
    if (stats.changesByType.form_structure > 5) {
      recommendations.push('Form structure changes frequently - monitor for stability');
    }
    
    if (stats.changesByType.validation_changed > 10) {
      recommendations.push('Form has active validation - wait for validation to complete');
    }
    
    if (stats.averageInterval < 500) {
      recommendations.push('Rapid changes detected - increase autofill delay');
    }

    return {
      formId,
      changeType: this.getDominantChangeType(stats.changesByType),
      patterns,
      predictions: {
        nextChange: prediction?.type,
        timeToNext: prediction?.timeEstimate,
        confidence: prediction?.confidence || 0,
      },
      recommendations,
    };
  }

  /**
   * Get dominant change type
   */
  private getDominantChangeType(changesByType: Record<string, number>): string {
    let maxCount = 0;
    let dominantType = 'unknown';
    
    for (const [type, count] of Object.entries(changesByType)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    }
    
    return dominantType;
  }

  /**
   * Calculate average interval between changes
   */
  private calculateAverageInterval(formId: string, changeType: string): number {
    const key = `${formId}-${changeType}`;
    const history = this.changeHistory.get(key);
    
    if (!history || history.length < 2) {
      return 1000; // Default 1 second
    }
    
    let totalInterval = 0;
    let intervalCount = 0;
    
    for (let i = 1; i < history.length; i++) {
      const interval = history[i].timestamp.getTime() - history[i - 1].timestamp.getTime();
      totalInterval += interval;
      intervalCount++;
    }
    
    return intervalCount > 0 ? totalInterval / intervalCount : 1000;
  }

  /**
   * Get recent changes
   */
  private getRecentChanges(formId: string, timeWindow: number): FormChangeEvent[] {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentChanges: FormChangeEvent[] = [];
    
    for (const [key, changes] of this.changeHistory.entries()) {
      if (key.startsWith(formId)) {
        for (const change of changes) {
          if (change.timestamp >= cutoff) {
            recentChanges.push(change);
          }
        }
      }
    }
    
    return recentChanges.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get all changes for a form
   */
  private getAllChanges(formId: string): Map<string, FormChangeEvent[]> {
    const formChanges = new Map<string, FormChangeEvent[]>();
    
    for (const [key, changes] of this.changeHistory.entries()) {
      if (key.startsWith(formId)) {
        formChanges.set(key, changes);
      }
    }
    
    return formChanges;
  }

  /**
   * Check if form is visible
   */
  private isFormVisible(formElement: HTMLFormElement): boolean {
    const rect = formElement.getBoundingClientRect();
    const style = window.getComputedStyle(formElement);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  /**
   * Count ready fields in form
   */
  private countReadyFields(form: MonitoredForm): number {
    let readyCount = 0;
    
    for (const element of form.fields.values()) {
      if (this.isFieldReady(element)) {
        readyCount++;
      }
    }
    
    return readyCount;
  }

  /**
   * Check if field is ready for autofill
   */
  private isFieldReady(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      !element.hasAttribute('disabled') &&
      !element.hasAttribute('readonly') &&
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  /**
   * Clean up old patterns
   */
  private cleanupPatterns(key: string): void {
    const patterns = this.patterns.get(key);
    if (!patterns) return;
    
    const cutoff = new Date(Date.now() - 300000); // 5 minutes
    
    const activePatterns = patterns.filter(pattern => 
      pattern.lastSeen >= cutoff || pattern.frequency >= this.patternThreshold
    );
    
    if (activePatterns.length !== patterns.length) {
      this.patterns.set(key, activePatterns);
    }
  }

  /**
   * Setup cleanup interval
   */
  private setupCleanupInterval(): void {
    setInterval(() => {
      this.performCleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Perform periodic cleanup
   */
  private performCleanup(): void {
    const cutoff = new Date(Date.now() - 600000); // 10 minutes
    
    // Clean up old change history
    for (const [key, changes] of this.changeHistory.entries()) {
      const recentChanges = changes.filter(change => change.timestamp >= cutoff);
      if (recentChanges.length !== changes.length) {
        if (recentChanges.length === 0) {
          this.changeHistory.delete(key);
        } else {
          this.changeHistory.set(key, recentChanges);
        }
      }
    }
    
    // Clean up old patterns
    for (const key of this.patterns.keys()) {
      this.cleanupPatterns(key);
    }
    
    // Clear old analysis cache
    this.analysisCache.clear();
  }

  /**
   * Destroy the change detector
   */
  destroy(): void {
    console.log('Destroying change detector');
    
    this.changeHistory.clear();
    this.patterns.clear();
    this.analysisCache.clear();
  }

  /**
   * Get detector statistics
   */
  getStats(): {
    trackedForms: number;
    totalChanges: number;
    totalPatterns: number;
    cacheSize: number;
  } {
    const trackedForms = new Set<string>();
    let totalChanges = 0;
    let totalPatterns = 0;
    
    for (const key of this.changeHistory.keys()) {
      const formId = key.split('-')[0];
      trackedForms.add(formId);
    }
    
    for (const changes of this.changeHistory.values()) {
      totalChanges += changes.length;
    }
    
    for (const patterns of this.patterns.values()) {
      totalPatterns += patterns.length;
    }
    
    return {
      trackedForms: trackedForms.size,
      totalChanges,
      totalPatterns,
      cacheSize: this.analysisCache.size,
    };
  }
}

// Create singleton instance
export const changeDetector = new ChangeDetector();