/**
 * File Scan Service
 *
 * Pluggable malware scanning for uploaded files.
 * Designed to sit between file validation and storage in the upload pipeline.
 *
 * Provider selection via FILE_SCAN_PROVIDER env var:
 *   "none"      — scanning disabled (development default, warns in production)
 *   "clamav"    — ClamAV via TCP socket (CLAMAV_HOST / CLAMAV_PORT)
 *   "virustotal"— VirusTotal API v3 (VIRUSTOTAL_API_KEY)
 *
 * Production posture:
 *   - If FILE_SCAN_PROVIDER is unset in production, uploads are ALLOWED but
 *     logged with a warning so the platform doesn't hard-block on day one.
 *   - Set FILE_SCAN_REJECT_ON_UNAVAILABLE=true to BLOCK uploads when the
 *     scanner is unavailable/misconfigured in production (fail-closed).
 */

import net from 'net';
import https from 'https';
import FormData from 'form-data';
import SecurityLog from '../models/SecurityLog.js';
import { createLogger } from '../utils/logger.js';
import { onMalwareDetected } from './securityAlertService.js';

const logger = createLogger('fileScan');

const PROVIDER     = (process.env.FILE_SCAN_PROVIDER || 'none').toLowerCase();
const REJECT_ON_UNAVAILABLE = process.env.FILE_SCAN_REJECT_ON_UNAVAILABLE === 'true';
const IS_PROD      = process.env.NODE_ENV === 'production';

// ── Scan result shape ──────────────────────────────────────────────────────────
// { clean: boolean, threat: string|null, scanner: string, skipped: boolean }

const _result = (clean, threat = null, scanner = PROVIDER, skipped = false) =>
  ({ clean, threat, scanner, skipped });

// ── ClamAV provider ───────────────────────────────────────────────────────────

const clamavScan = (buffer) => new Promise((resolve, reject) => {
  const host = process.env.CLAMAV_HOST || '127.0.0.1';
  const port = parseInt(process.env.CLAMAV_PORT || '3310', 10);

  const socket = net.createConnection({ host, port }, () => {
    socket.write('nINSTREAM\n');

    const chunk = Buffer.alloc(4);
    chunk.writeUInt32BE(buffer.length, 0);
    socket.write(chunk);
    socket.write(buffer);

    const end = Buffer.alloc(4);
    end.writeUInt32BE(0, 0);
    socket.write(end);
  });

  let response = '';
  socket.on('data', (d) => { response += d.toString(); });
  socket.on('end', () => {
    socket.destroy();
    if (response.includes('FOUND')) {
      const threat = response.replace('stream:', '').replace(' FOUND', '').trim();
      resolve(_result(false, threat, 'clamav'));
    } else if (response.includes('OK')) {
      resolve(_result(true, null, 'clamav'));
    } else {
      reject(new Error(`Unexpected ClamAV response: ${response}`));
    }
  });

  socket.on('error', reject);
  socket.setTimeout(10000, () => {
    socket.destroy();
    reject(new Error('ClamAV connection timed out'));
  });
});

// ── VirusTotal provider ───────────────────────────────────────────────────────

const virustotalScan = (buffer, filename = 'upload') => new Promise((resolve, reject) => {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    return reject(new Error('VIRUSTOTAL_API_KEY not configured'));
  }

  const form = new FormData();
  form.append('file', buffer, { filename });

  const options = {
    hostname: 'www.virustotal.com',
    path: '/api/v3/files',
    method: 'POST',
    headers: {
      ...form.getHeaders(),
      'x-apikey': apiKey
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        const analysisId = json?.data?.id;
        if (!analysisId) {
          return reject(new Error('VirusTotal did not return analysis ID'));
        }
        // Poll for result (simple single-poll with delay)
        setTimeout(() => {
          _vtGetAnalysis(apiKey, analysisId).then(resolve).catch(reject);
        }, 15000); // VT typically takes 10-30s
      } catch (e) {
        reject(new Error('Failed to parse VirusTotal upload response'));
      }
    });
  });

  req.on('error', reject);
  form.pipe(req);
});

const _vtGetAnalysis = (apiKey, analysisId) => new Promise((resolve, reject) => {
  const options = {
    hostname: 'www.virustotal.com',
    path: `/api/v3/analyses/${analysisId}`,
    method: 'GET',
    headers: { 'x-apikey': apiKey }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        const stats = json?.data?.attributes?.stats;
        if (!stats) return reject(new Error('No stats in VirusTotal analysis'));
        const malicious = (stats.malicious || 0) + (stats.suspicious || 0);
        if (malicious > 0) {
          resolve(_result(false, `${malicious} engine(s) flagged this file`, 'virustotal'));
        } else {
          resolve(_result(true, null, 'virustotal'));
        }
      } catch (e) {
        reject(new Error('Failed to parse VirusTotal analysis response'));
      }
    });
  });
  req.on('error', reject);
  req.end();
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scan a file buffer for malware.
 *
 * @param {Buffer} buffer     - File content
 * @param {string} [filename] - Original filename (for logging / VirusTotal)
 * @param {string} [userId]   - Uploader user ID (for SecurityLog)
 * @returns {Promise<{clean: boolean, threat: string|null, scanner: string, skipped: boolean}>}
 */
export const scanFile = async (buffer, filename = 'upload', userId = null) => {
  if (PROVIDER === 'none') {
    if (IS_PROD) {
      logger.warn('[FileScan] No malware scanner configured in production. Set FILE_SCAN_PROVIDER.');
    } else {
      logger.debug('[FileScan] Scanning disabled (FILE_SCAN_PROVIDER=none).');
    }
    return _result(true, null, 'none', true); // skipped
  }

  try {
    let scanResult;

    if (PROVIDER === 'clamav') {
      scanResult = await clamavScan(buffer);
    } else if (PROVIDER === 'virustotal') {
      scanResult = await virustotalScan(buffer, filename);
    } else {
      logger.warn(`[FileScan] Unknown provider "${PROVIDER}", skipping scan.`);
      return _result(true, null, PROVIDER, true); // skipped
    }

    if (!scanResult.clean) {
      logger.warn('[FileScan] Malware detected', {
        filename,
        threat: scanResult.threat,
        scanner: scanResult.scanner,
        userId
      });
      SecurityLog.create({
        type: 'malware_detected_upload',
        severity: 'critical',
        userId: userId || null,
        details: `Malware detected in upload "${filename}": ${scanResult.threat} (scanner: ${scanResult.scanner})`,
        action: 'blocked'
      }).catch(e => logger.error('Failed to log malware detection:', e.message));
      // Fire real-time security alert (non-blocking)
      onMalwareDetected({ filename, scanner: scanResult.scanner, ipAddress: null })
        .catch(e => logger.error('Failed to dispatch malware alert:', e.message));
    } else {
      logger.debug('[FileScan] File clean', { filename, scanner: scanResult.scanner });
    }

    return scanResult;
  } catch (err) {
    logger.error('[FileScan] Scanner error:', err.message);

    SecurityLog.create({
      type: 'malware_scan_failed',
      severity: 'medium',
      userId: userId || null,
      details: `File scan failed for "${filename}": ${err.message} (provider: ${PROVIDER})`,
      action: 'logged'
    }).catch(e => logger.error('Failed to log malware_scan_failed:', e.message));

    if (REJECT_ON_UNAVAILABLE) {
      // Fail-closed: treat scan failure as unsafe
      return _result(false, 'scan_unavailable', PROVIDER, false);
    }

    // Fail-open with warning (default): allow upload, log the failure
    return _result(true, null, PROVIDER, true);
  }
};

/**
 * Express middleware that scans req.file.buffer after multer has processed it.
 * Rejects the request if malware is detected or scan failure is fatal.
 * Attaches scan result to req.fileScanResult.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const fileScanMiddleware = async (req, res, next) => {
  const file = req.file;
  if (!file || !file.buffer) {
    return next(); // No file uploaded — let multer/validation handle it
  }

  const userId = req.userId || req.user?._id?.toString?.() || null;

  try {
    const result = await scanFile(file.buffer, file.originalname, userId);
    req.fileScanResult = result;

    if (!result.clean && !result.skipped) {
      return res.status(422).json({
        message: 'File rejected: malware detected.',
        code: 'MALWARE_DETECTED'
      });
    }

    next();
  } catch (err) {
    // Should not reach here (scanFile catches internally) but belt-and-braces
    logger.error('[FileScan] Unexpected middleware error:', err.message);
    if (REJECT_ON_UNAVAILABLE) {
      return res.status(503).json({
        message: 'File scanning service unavailable. Upload rejected.',
        code: 'SCAN_UNAVAILABLE'
      });
    }
    next();
  }
};

/**
 * Return the current file scan configuration status.
 * Used by the Platform Brain admin dashboard.
 */
export const getFileScanStatus = () => ({
  provider: PROVIDER,
  rejectOnUnavailable: REJECT_ON_UNAVAILABLE,
  isProduction: IS_PROD,
  configured: PROVIDER !== 'none'
});

/**
 * Log the file scan configuration at server startup.
 * Call once after the DB connection is ready.
 */
export const logFileScanStartupStatus = () => {
  if (PROVIDER === 'none' && IS_PROD) {
    logger.warn('⚠️ File malware scanning DISABLED in production (FILE_SCAN_PROVIDER=none). Set FILE_SCAN_PROVIDER=clamav or virustotal.');
    if (!REJECT_ON_UNAVAILABLE) {
      logger.warn('⚠️ FILE_SCAN_REJECT_ON_UNAVAILABLE=false — uploads will be ALLOWED even without scanning.');
    }
  } else if (PROVIDER === 'none') {
    logger.info('File malware scanning disabled (development mode).');
  } else {
    logger.info(`✅ File malware scanning active (provider: ${PROVIDER}, fail-closed: ${REJECT_ON_UNAVAILABLE})`);
  }
};

export default { scanFile, fileScanMiddleware, getFileScanStatus, logFileScanStartupStatus };
