import { useState, useEffect, useRef } from 'react';
import './OptimizedImage.css';

/**
 * OptimizedImage Component
 *
 * Features:
 * - Lazy loading (loads images only when visible)
 * - Progressive loading (blur-up effect)
 * - AVIF support with WebP and JPEG fallback
 * - Responsive images with srcset
 * - Loading placeholder
 * - Error handling
 */
function OptimizedImage({
  src,
  alt = '',
  className = '',
  onClick,
  style = {},
  loading = 'lazy', // 'lazy' or 'eager'
  aspectRatio, // e.g., '16/9', '1/1', '4/3'
  placeholder = true, // Show loading placeholder
  sizes, // Responsive sizes attribute
  fetchPriority, // 'high', 'low', or 'auto'
  responsiveSizes, // Object with avatar/feed/full sizes from backend (each with webp/avif)
  imageSize = 'feed', // Which size to use: 'avatar', 'feed', or 'full'
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(loading === 'eager');
  const imgRef = useRef(null);

  // Helper function to get image URL
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://pryde-social.onrender.com'}${path}`;
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (loading === 'eager' || !imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before image enters viewport (faster perceived load)
        threshold: 0.01
      }
    );

    observer.observe(imgRef.current);

    return () => {
      if (observer) observer.disconnect();
    };
  }, [loading]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const imageUrl = getImageUrl(src);

  // Generate srcset for AVIF and WebP sources
  const generateSourceSets = () => {
    if (!responsiveSizes) return null;

    const sources = {
      avif: { avatar: null, feed: null, full: null },
      webp: { avatar: null, feed: null, full: null }
    };

    // Build AVIF srcset
    if (responsiveSizes.avatar?.avif) {
      sources.avif.avatar = getImageUrl(responsiveSizes.avatar.avif);
    }
    if (responsiveSizes.feed?.avif) {
      sources.avif.feed = getImageUrl(responsiveSizes.feed.avif);
    }
    if (responsiveSizes.full?.avif) {
      sources.avif.full = getImageUrl(responsiveSizes.full.avif);
    }

    // Build WebP srcset
    if (responsiveSizes.avatar?.webp) {
      sources.webp.avatar = getImageUrl(responsiveSizes.avatar.webp);
    }
    if (responsiveSizes.feed?.webp) {
      sources.webp.feed = getImageUrl(responsiveSizes.feed.webp);
    }
    if (responsiveSizes.full?.webp) {
      sources.webp.full = getImageUrl(responsiveSizes.full.webp);
    }

    return sources;
  };

  const sources = generateSourceSets();

  // Determine which image to use based on imageSize prop
  const getImageForSize = (format) => {
    if (!sources) return imageUrl;

    const sizeMap = sources[format];
    if (!sizeMap) return imageUrl;

    // Return the requested size, or fall back to next available size
    if (imageSize === 'avatar' && sizeMap.avatar) return sizeMap.avatar;
    if (imageSize === 'feed' && sizeMap.feed) return sizeMap.feed;
    if (imageSize === 'full' && sizeMap.full) return sizeMap.full;

    // Fallback: try to find any available size
    return sizeMap.feed || sizeMap.full || sizeMap.avatar || imageUrl;
  };

  // Default sizes attribute for responsive images
  const defaultSizes = sizes || (
    imageSize === 'avatar' ? '48px' :
    imageSize === 'feed' ? '(max-width: 640px) 100vw, 600px' :
    '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px'
  );

  // Container style with aspect ratio
  const containerStyle = {
    ...style,
    ...(aspectRatio && { aspectRatio })
  };

  return (
    <div 
      ref={imgRef}
      className={`optimized-image-container ${className}`}
      style={containerStyle}
      onClick={onClick}
    >
      {/* Loading placeholder */}
      {placeholder && !isLoaded && !hasError && (
        <div className="image-placeholder shimmer" />
      )}

      {/* Error state */}
      {hasError && (
        <div className="image-error">
          <span>🖼️</span>
          <p>Image unavailable</p>
        </div>
      )}

      {/* Actual image with AVIF + WebP support */}
      {isInView && !hasError && (
        sources ? (
          <picture>
            {/* AVIF source (best compression, ~50% smaller than WebP) */}
            <source
              type="image/avif"
              srcSet={getImageForSize('avif')}
              sizes={defaultSizes}
            />

            {/* WebP source (fallback for browsers without AVIF support) */}
            <source
              type="image/webp"
              srcSet={getImageForSize('webp')}
              sizes={defaultSizes}
            />

            {/* JPEG/PNG fallback (for very old browsers) */}
            <img
              src={imageUrl}
              alt={alt}
              className={`optimized-image ${isLoaded ? 'loaded' : 'loading'}`}
              onLoad={handleLoad}
              onError={handleError}
              loading={loading}
              decoding="async"
              fetchpriority={fetchPriority}
              {...props}
            />
          </picture>
        ) : (
          <img
            src={imageUrl}
            alt={alt}
            className={`optimized-image ${isLoaded ? 'loaded' : 'loading'}`}
            onLoad={handleLoad}
            onError={handleError}
            loading={loading}
            decoding="async"
            fetchpriority={fetchPriority}
            {...props}
          />
        )
      )}
    </div>
  );
}

export default OptimizedImage;

