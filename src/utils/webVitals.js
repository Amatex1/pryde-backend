/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals for performance monitoring
 */

import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';

/**
 * Report Web Vitals to analytics
 * @param {Function} onPerfEntry - Callback function to handle performance entries
 */
export function reportWebVitals(onPerfEntry) {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    onCLS(onPerfEntry);
    onINP(onPerfEntry); // Replaced FID with INP (Interaction to Next Paint)
    onFCP(onPerfEntry);
    onLCP(onPerfEntry);
    onTTFB(onPerfEntry);
  }
}

/**
 * Send Web Vitals to analytics service
 * @param {Object} metric - Web Vitals metric object
 */
export function sendToAnalytics({ name, delta, value, id, rating }) {
  // Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${name}:`, {
      value: Math.round(name === 'CLS' ? value * 1000 : value),
      delta: Math.round(name === 'CLS' ? delta * 1000 : delta),
      rating,
      id
    });
  }

  // Send to analytics in production
  if (import.meta.env.PROD) {
    // Google Analytics 4
    if (window.gtag) {
      window.gtag('event', name, {
        event_category: 'Web Vitals',
        value: Math.round(name === 'CLS' ? delta * 1000 : delta),
        event_label: id,
        non_interaction: true,
      });
    }

    // Custom analytics endpoint (optional)
    if (window.navigator.sendBeacon) {
      const body = JSON.stringify({
        name,
        value: Math.round(name === 'CLS' ? value * 1000 : value),
        delta: Math.round(name === 'CLS' ? delta * 1000 : delta),
        rating,
        id,
        url: window.location.href,
        timestamp: Date.now()
      });

      // Send to your backend analytics endpoint
      // window.navigator.sendBeacon('/api/analytics/web-vitals', body);
    }
  }
}

/**
 * Get performance rating based on thresholds
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @returns {string} - 'good', 'needs-improvement', or 'poor'
 */
export function getPerformanceRating(name, value) {
  const thresholds = {
    LCP: { good: 2500, poor: 4000 },
    INP: { good: 200, poor: 500 }, // Replaced FID with INP
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 }
  };

  const threshold = thresholds[name];
  if (!threshold) return 'unknown';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Log Web Vitals summary
 */
export function logWebVitalsSummary() {
  const metrics = {};

  const logMetric = ({ name, value, rating }) => {
    metrics[name] = {
      value: Math.round(name === 'CLS' ? value * 1000 : value),
      rating
    };

    // Log summary when all metrics are collected
    if (Object.keys(metrics).length === 5) {
      console.table(metrics);
    }
  };

  reportWebVitals(logMetric);
}

/**
 * Initialize Web Vitals monitoring
 */
export function initWebVitals() {
  if (import.meta.env.PROD) {
    // Send to analytics in production
    reportWebVitals(sendToAnalytics);
  } else {
    // Log to console in development
    logWebVitalsSummary();
  }
}

