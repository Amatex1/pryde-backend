import React from 'react';
import './Button.css';

/**
 * Reusable Button Component
 * 
 * Uses the Pryde Social design system button classes from components.css
 * 
 * @param {string} variant - Button style: 'primary', 'secondary', 'ghost', 'danger', 'success'
 * @param {string} size - Button size: 'sm', 'md' (default), 'lg', 'icon', 'icon-sm'
 * @param {boolean} disabled - Whether button is disabled
 * @param {string} className - Additional CSS classes
 * @param {React.ReactNode} children - Button content
 * @param {object} props - Additional props passed to button element
 */
export const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  className = '',
  children,
  ...props 
}) => {
  // Build class names
  const classes = [
    'pryde-btn',
    variant !== 'primary' && `pryde-btn-${variant}`,
    size !== 'md' && `pryde-btn-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button 
      className={classes} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;

