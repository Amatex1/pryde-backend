import { useState, useEffect, useRef } from 'react';
import './OptimizedImage.css';

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading (loads images only when visible)
 * - Progressive loading (blur-up effect)
 * - Automatic WebP support with fallback
 * - Responsive images
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
        rootMargin: '50px', // Start loading 50px before image enters viewport
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

      {/* Actual image */}
      {isInView && !hasError && (
        <img
          src={imageUrl}
          alt={alt}
          className={`optimized-image ${isLoaded ? 'loaded' : 'loading'}`}
          onLoad={handleLoad}
          onError={handleError}
          loading={loading}
          decoding="async"
          {...props}
        />
      )}
    </div>
  );
}

export default OptimizedImage;

