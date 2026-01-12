/**
 * API Versioning Middleware
 * 
 * Supports multiple API versions for backward compatibility.
 * Routes can be versioned using URL path (/api/v1/, /api/v2/) or headers.
 * 
 * Usage:
 *   app.use('/api/v1', v1Routes);
 *   app.use('/api/v2', v2Routes);
 */

/**
 * Current API version
 */
export const CURRENT_VERSION = 'v1';

/**
 * Supported API versions
 */
export const SUPPORTED_VERSIONS = ['v1'];

/**
 * Deprecated API versions (still supported but will be removed)
 */
export const DEPRECATED_VERSIONS = [];

/**
 * Extract API version from request
 * 
 * Priority:
 * 1. URL path (/api/v1/...)
 * 2. Accept-Version header
 * 3. Default to current version
 * 
 * @param {Object} req - Express request
 * @returns {string} API version
 */
export const getApiVersion = (req) => {
  // Check URL path
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  // Check Accept-Version header
  const headerVersion = req.headers['accept-version'];
  if (headerVersion && SUPPORTED_VERSIONS.includes(headerVersion)) {
    return headerVersion;
  }
  
  // Default to current version
  return CURRENT_VERSION;
};

/**
 * Check if API version is supported
 * 
 * @param {string} version - API version
 * @returns {boolean} Is supported
 */
export const isVersionSupported = (version) => {
  return SUPPORTED_VERSIONS.includes(version);
};

/**
 * Check if API version is deprecated
 * 
 * @param {string} version - API version
 * @returns {boolean} Is deprecated
 */
export const isVersionDeprecated = (version) => {
  return DEPRECATED_VERSIONS.includes(version);
};

/**
 * API version middleware
 * 
 * Adds version info to request and response headers
 */
export const apiVersionMiddleware = (req, res, next) => {
  const version = getApiVersion(req);
  
  // Add version to request
  req.apiVersion = version;
  
  // Add version to response headers
  res.setHeader('X-API-Version', version);
  
  // Add deprecation warning if needed
  if (isVersionDeprecated(version)) {
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Sunset-Date', '2026-12-31'); // Example sunset date
    console.warn(`⚠️ Deprecated API version used: ${version}`);
  }
  
  // Check if version is supported
  if (!isVersionSupported(version)) {
    return res.status(400).json({
      message: `API version ${version} is not supported`,
      code: 'UNSUPPORTED_API_VERSION',
      supportedVersions: SUPPORTED_VERSIONS,
      currentVersion: CURRENT_VERSION
    });
  }
  
  next();
};

/**
 * Version-specific response formatter
 * 
 * Allows different response formats for different API versions
 * 
 * @param {Object} req - Express request
 * @param {Object} data - Response data
 * @returns {Object} Formatted response
 */
export const formatResponse = (req, data) => {
  const version = req.apiVersion || CURRENT_VERSION;
  
  switch (version) {
    case 'v1':
      // v1 format: simple data object
      return data;
    
    case 'v2':
      // v2 format: wrapped in data envelope
      return {
        data,
        meta: {
          version: 'v2',
          timestamp: new Date().toISOString()
        }
      };
    
    default:
      return data;
  }
};

/**
 * Version-specific error formatter
 * 
 * @param {Object} req - Express request
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @returns {Object} Formatted error
 */
export const formatError = (req, message, code) => {
  const version = req.apiVersion || CURRENT_VERSION;
  
  switch (version) {
    case 'v1':
      return { message, code };
    
    case 'v2':
      return {
        error: {
          message,
          code,
          timestamp: new Date().toISOString()
        }
      };
    
    default:
      return { message, code };
  }
};

/**
 * Create versioned router
 * 
 * @param {string} version - API version
 * @returns {Object} Express router
 */
export const createVersionedRouter = (version) => {
  const router = express.Router();
  
  // Add version to all routes
  router.use((req, res, next) => {
    req.apiVersion = version;
    res.setHeader('X-API-Version', version);
    next();
  });
  
  return router;
};

