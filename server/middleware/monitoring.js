/**
 * Monitoring Middleware
 * 
 * Tracks request performance and errors
 */

const monitor = require('../utils/productionMonitoring');

/**
 * Request performance tracking middleware
 */
function requestMonitoring(req, res, next) {
  const startTime = Date.now();
  
  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Track slow requests
    monitor.trackSlowRequest(duration);
    
    // Track auth failures (401 responses)
    if (res.statusCode === 401) {
      monitor.trackAuthFailure('unauthorized');
    }
  });
  
  next();
}

/**
 * Error tracking middleware
 */
function errorMonitoring(err, req, res, next) {
  // Track unhandled exception
  monitor.trackUnhandledException(err);
  
  // Pass to next error handler
  next(err);
}

/**
 * Metrics endpoint (admin only)
 */
function metricsEndpoint(req, res) {
  try {
    const metrics = monitor.getMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
}

module.exports = {
  requestMonitoring,
  errorMonitoring,
  metricsEndpoint
};

