/**
 * AI Performance Monitor for tracking and optimizing AI operations
 */

export interface PerformanceMetrics {
  cacheHitRate: number;
  averageResponseTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  tokenUsage: {
    total: number;
    average: number;
    daily: number;
  };
  batchingEfficiency: {
    batchedRequests: number;
    totalRequests: number;
    averageBatchSize: number;
  };
  compressionRatio: number;
  memoryUsage: number;
}

export interface PerformanceEvent {
  type: 'cache_hit' | 'cache_miss' | 'api_request' | 'batch_processed' | 'compression_applied';
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Performance monitoring and optimization for AI operations
 */
export class AIPerformanceMonitor {
  private events: PerformanceEvent[] = [];
  private maxEvents = 1000; // Keep last 1000 events
  private metricsCache: PerformanceMetrics | null = null;
  private metricsCacheExpiry = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Record a performance event
   */
  recordEvent(event: Omit<PerformanceEvent, 'timestamp'>): void {
    const fullEvent: PerformanceEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Maintain event history size
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }

    // Invalidate metrics cache
    this.metricsCache = null;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now();
    
    // Return cached metrics if still valid
    if (this.metricsCache && now < this.metricsCacheExpiry) {
      return this.metricsCache;
    }

    // Calculate fresh metrics
    this.metricsCache = this.calculateMetrics();
    this.metricsCacheExpiry = now + this.CACHE_TTL;
    
    return this.metricsCache;
  }

  /**
   * Calculate performance metrics from events
   */
  private calculateMetrics(): PerformanceMetrics {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp.getTime() > oneDayAgo);

    // Cache metrics
    const cacheHits = recentEvents.filter(e => e.type === 'cache_hit').length;
    const cacheMisses = recentEvents.filter(e => e.type === 'cache_miss').length;
    const totalCacheRequests = cacheHits + cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0;

    // API request metrics
    const apiRequests = recentEvents.filter(e => e.type === 'api_request');
    const successfulRequests = apiRequests.filter(e => !e.metadata?.error).length;
    const failedRequests = apiRequests.length - successfulRequests;
    const totalRequests = apiRequests.length;

    // Response time metrics
    const requestsWithDuration = apiRequests.filter(e => e.duration);
    const averageResponseTime = requestsWithDuration.length > 0
      ? requestsWithDuration.reduce((sum, e) => sum + (e.duration || 0), 0) / requestsWithDuration.length
      : 0;

    // Token usage metrics
    const tokenUsageEvents = apiRequests.filter(e => e.metadata?.tokensUsed);
    const totalTokens = tokenUsageEvents.reduce((sum, e) => sum + (e.metadata?.tokensUsed || 0), 0);
    const averageTokens = tokenUsageEvents.length > 0 ? totalTokens / tokenUsageEvents.length : 0;

    // Batching metrics
    const batchEvents = recentEvents.filter(e => e.type === 'batch_processed');
    const batchedRequests = batchEvents.reduce((sum, e) => sum + (e.metadata?.batchSize || 0), 0);
    const averageBatchSize = batchEvents.length > 0 ? batchedRequests / batchEvents.length : 0;

    // Compression metrics
    const compressionEvents = recentEvents.filter(e => e.type === 'compression_applied');
    const compressionRatios = compressionEvents
      .filter(e => e.metadata?.originalSize && e.metadata?.compressedSize)
      .map(e => (e.metadata!.compressedSize / e.metadata!.originalSize) * 100);
    const averageCompressionRatio = compressionRatios.length > 0
      ? compressionRatios.reduce((sum, ratio) => sum + ratio, 0) / compressionRatios.length
      : 100;

    // Memory usage (estimated)
    const memoryUsage = this.estimateMemoryUsage();

    return {
      cacheHitRate,
      averageResponseTime,
      totalRequests,
      successfulRequests,
      failedRequests,
      tokenUsage: {
        total: totalTokens,
        average: averageTokens,
        daily: totalTokens, // Same as total for daily window
      },
      batchingEfficiency: {
        batchedRequests,
        totalRequests,
        averageBatchSize,
      },
      compressionRatio: averageCompressionRatio,
      memoryUsage,
    };
  }

  /**
   * Estimate memory usage of stored events
   */
  private estimateMemoryUsage(): number {
    // Rough estimation: each event is approximately 200 bytes
    return this.events.length * 200;
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];

    // Cache hit rate recommendations
    if (metrics.cacheHitRate < 30) {
      recommendations.push('Consider increasing cache TTL or size to improve hit rate');
    } else if (metrics.cacheHitRate > 80) {
      recommendations.push('Excellent cache performance! Consider reducing cache size if memory is a concern');
    }

    // Response time recommendations
    if (metrics.averageResponseTime > 10000) { // 10 seconds
      recommendations.push('API response times are high. Consider implementing request batching or reducing payload size');
    }

    // Token usage recommendations
    if (metrics.tokenUsage.average > 3000) {
      recommendations.push('High token usage detected. Consider optimizing HTML extraction or using compression');
    }

    // Batching efficiency recommendations
    const batchingRate = metrics.batchingEfficiency.batchedRequests / Math.max(1, metrics.batchingEfficiency.totalRequests);
    if (batchingRate < 0.3 && metrics.totalRequests > 10) {
      recommendations.push('Low batching efficiency. Consider enabling batching for similar requests');
    }

    // Error rate recommendations
    const errorRate = metrics.failedRequests / Math.max(1, metrics.totalRequests);
    if (errorRate > 0.1) { // 10% error rate
      recommendations.push('High error rate detected. Check API token validity and network connectivity');
    }

    // Memory usage recommendations
    if (metrics.memoryUsage > 100000) { // 100KB
      recommendations.push('High memory usage for performance monitoring. Consider reducing event history size');
    }

    return recommendations;
  }

  /**
   * Export performance data for analysis
   */
  exportData(): {
    metrics: PerformanceMetrics;
    events: PerformanceEvent[];
    recommendations: string[];
  } {
    return {
      metrics: this.getMetrics(),
      events: [...this.events], // Copy to prevent mutation
      recommendations: this.getRecommendations(),
    };
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.events = [];
    this.metricsCache = null;
    this.metricsCacheExpiry = 0;
  }

  /**
   * Get performance summary for logging
   */
  getSummary(): string {
    const metrics = this.getMetrics();
    
    return [
      `🎯 Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%`,
      `⚡ Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`,
      `📊 Success Rate: ${((metrics.successfulRequests / Math.max(1, metrics.totalRequests)) * 100).toFixed(1)}%`,
      `🔤 Avg Tokens: ${metrics.tokenUsage.average.toFixed(0)}`,
      `📦 Batch Efficiency: ${((metrics.batchingEfficiency.batchedRequests / Math.max(1, metrics.batchingEfficiency.totalRequests)) * 100).toFixed(1)}%`,
    ].join(' | ');
  }

  /**
   * Start automatic performance logging
   */
  startPerformanceLogging(intervalMs: number = 300000): NodeJS.Timeout { // 5 minutes default
    return setInterval(() => {
      const summary = this.getSummary();
      console.log(`🤖 AI Performance Summary: ${summary}`);
      
      const recommendations = this.getRecommendations();
      if (recommendations.length > 0) {
        console.group('💡 Performance Recommendations:');
        recommendations.forEach(rec => console.log(`• ${rec}`));
        console.groupEnd();
      }
    }, intervalMs);
  }
}

// Export singleton instance
export const aiPerformanceMonitor = new AIPerformanceMonitor();