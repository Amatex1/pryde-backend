/**
 * Production Monitoring Utilities
 * 
 * Light-touch error tracking and metrics without PII
 * - Unhandled exceptions
 * - Auth failures (counts only)
 * - Socket health metrics
 * - Cache performance metrics
 * 
 * Rules:
 * - No PII (no usernames, emails, tokens)
 * - No noisy dashboards
 * - No performance penalty
 */

class ProductionMonitor {
  constructor() {
    this.metrics = {
      errors: {
        unhandled: 0,
        auth: 0,
        socket: 0,
        database: 0,
        validation: 0
      },
      socket: {
        connections: 0,
        disconnections: 0,
        reconnects: 0,
        dedupHits: 0,
        dedupMisses: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        evictions: 0
      },
      performance: {
        slowQueries: 0,
        slowRequests: 0
      }
    };
    
    this.startTime = Date.now();
    this.enabled = process.env.NODE_ENV === 'production';
  }
  
  /**
   * Track unhandled exception
   * @param {Error} error - Error object (sanitized)
   */
  trackUnhandledException(error) {
    if (!this.enabled) return;
    
    this.metrics.errors.unhandled++;
    
    // Log sanitized error (no PII)
    console.error('[Monitor] Unhandled exception:', {
      type: error.name,
      message: this.sanitizeMessage(error.message),
      stack: error.stack?.split('\n')[0], // First line only
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Track auth failure
   * @param {string} reason - Failure reason (sanitized)
   */
  trackAuthFailure(reason) {
    if (!this.enabled) return;
    
    this.metrics.errors.auth++;
    
    // Count only, no details
    if (this.metrics.errors.auth % 10 === 0) {
      console.warn(`[Monitor] Auth failures: ${this.metrics.errors.auth}`);
    }
  }
  
  /**
   * Track socket connection
   */
  trackSocketConnection() {
    if (!this.enabled) return;
    this.metrics.socket.connections++;
  }
  
  /**
   * Track socket disconnection
   */
  trackSocketDisconnection() {
    if (!this.enabled) return;
    this.metrics.socket.disconnections++;
  }
  
  /**
   * Track socket reconnect
   */
  trackSocketReconnect() {
    if (!this.enabled) return;
    this.metrics.socket.reconnects++;
    
    // Log if reconnects are frequent
    if (this.metrics.socket.reconnects % 10 === 0) {
      console.warn(`[Monitor] Socket reconnects: ${this.metrics.socket.reconnects}`);
    }
  }
  
  /**
   * Track deduplication hit
   */
  trackDedupHit() {
    if (!this.enabled) return;
    this.metrics.socket.dedupHits++;
  }
  
  /**
   * Track deduplication miss
   */
  trackDedupMiss() {
    if (!this.enabled) return;
    this.metrics.socket.dedupMisses++;
  }
  
  /**
   * Track cache hit
   */
  trackCacheHit() {
    if (!this.enabled) return;
    this.metrics.cache.hits++;
  }
  
  /**
   * Track cache miss
   */
  trackCacheMiss() {
    if (!this.enabled) return;
    this.metrics.cache.misses++;
  }
  
  /**
   * Track cache eviction
   */
  trackCacheEviction() {
    if (!this.enabled) return;
    this.metrics.cache.evictions++;
  }
  
  /**
   * Track slow database query
   * @param {number} duration - Query duration in ms
   */
  trackSlowQuery(duration) {
    if (!this.enabled) return;
    
    if (duration > 1000) { // > 1 second
      this.metrics.performance.slowQueries++;
      console.warn(`[Monitor] Slow query detected: ${duration}ms`);
    }
  }
  
  /**
   * Track slow HTTP request
   * @param {number} duration - Request duration in ms
   */
  trackSlowRequest(duration) {
    if (!this.enabled) return;
    
    if (duration > 3000) { // > 3 seconds
      this.metrics.performance.slowRequests++;
      console.warn(`[Monitor] Slow request detected: ${duration}ms`);
    }
  }
  
  /**
   * Get current metrics
   * @returns {object} - Current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    
    return {
      ...this.metrics,
      uptime: {
        ms: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 60000),
        hours: Math.floor(uptime / 3600000)
      },
      ratios: {
        dedupHitRate: this.calculateRate(
          this.metrics.socket.dedupHits,
          this.metrics.socket.dedupHits + this.metrics.socket.dedupMisses
        ),
        cacheHitRate: this.calculateRate(
          this.metrics.cache.hits,
          this.metrics.cache.hits + this.metrics.cache.misses
        )
      }
    };
  }
  
  /**
   * Calculate percentage rate
   * @param {number} numerator
   * @param {number} denominator
   * @returns {string} - Percentage string
   */
  calculateRate(numerator, denominator) {
    if (denominator === 0) return '0%';
    return `${((numerator / denominator) * 100).toFixed(2)}%`;
  }
  
  /**
   * Sanitize error message (remove PII)
   * @param {string} message - Error message
   * @returns {string} - Sanitized message
   */
  sanitizeMessage(message) {
    if (!message) return 'Unknown error';
    
    // Remove email addresses
    let sanitized = message.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
    
    // Remove tokens
    sanitized = sanitized.replace(/[A-Za-z0-9-_]{20,}/g, '[TOKEN]');
    
    // Remove ObjectIds
    sanitized = sanitized.replace(/[0-9a-f]{24}/g, '[ID]');
    
    return sanitized;
  }
  
  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      errors: { unhandled: 0, auth: 0, socket: 0, database: 0, validation: 0 },
      socket: { connections: 0, disconnections: 0, reconnects: 0, dedupHits: 0, dedupMisses: 0 },
      cache: { hits: 0, misses: 0, evictions: 0 },
      performance: { slowQueries: 0, slowRequests: 0 }
    };
    this.startTime = Date.now();
  }
}

// Singleton instance
const monitor = new ProductionMonitor();

// Export singleton
module.exports = monitor;

