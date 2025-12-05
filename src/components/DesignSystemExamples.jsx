/**
 * PRYDE SOCIAL - DESIGN SYSTEM EXAMPLES
 * 
 * This file demonstrates how to use the new design system components and utilities.
 * Use these examples as a reference when updating pages.
 */

import React from 'react';

export function DesignSystemExamples() {
  return (
    <div className="container">
      <h1 className="h1-page-title">Design System Examples</h1>
      
      {/* ========================================
          CARDS
          ======================================== */}
      <section>
        <h2 className="h2-section-title">Cards</h2>
        
        {/* Basic Card */}
        <div className="pryde-card">
          <h3 className="h3-subsection-title">Basic Card</h3>
          <p>This is a standard card with padding and shadow.</p>
        </div>
        
        {/* Compact Card */}
        <div className="pryde-card pryde-card-compact">
          <p>Compact card with less padding</p>
        </div>
        
        {/* Spacious Card */}
        <div className="pryde-card pryde-card-spacious">
          <h3 className="h3-subsection-title">Spacious Card</h3>
          <p>This card has more padding for important content.</p>
        </div>
      </section>

      {/* ========================================
          BUTTONS
          ======================================== */}
      <section className="mt-6">
        <h2 className="h2-section-title">Buttons</h2>
        
        <div className="flex gap-3">
          {/* Primary Button */}
          <button className="pryde-btn">Primary Button</button>
          
          {/* Secondary Button */}
          <button className="pryde-btn pryde-btn-secondary">Secondary</button>
          
          {/* Ghost Button */}
          <button className="pryde-btn pryde-btn-ghost">Ghost</button>
          
          {/* Danger Button */}
          <button className="pryde-btn pryde-btn-danger">Delete</button>
          
          {/* Success Button */}
          <button className="pryde-btn pryde-btn-success">Save</button>
        </div>
        
        {/* Button Sizes */}
        <div className="flex gap-3 mt-4">
          <button className="pryde-btn pryde-btn-sm">Small</button>
          <button className="pryde-btn">Default</button>
          <button className="pryde-btn pryde-btn-lg">Large</button>
        </div>
        
        {/* Icon Buttons */}
        <div className="flex gap-3 mt-4">
          <button className="pryde-btn pryde-btn-icon">❤️</button>
          <button className="pryde-btn pryde-btn-icon-sm">✨</button>
        </div>
      </section>

      {/* ========================================
          FORMS
          ======================================== */}
      <section className="mt-6">
        <h2 className="h2-section-title">Forms</h2>
        
        <div className="pryde-card">
          {/* Input Field */}
          <div className="pryde-form-group">
            <label className="pryde-label">Email Address</label>
            <input 
              type="email" 
              className="pryde-input" 
              placeholder="Enter your email"
            />
            <span className="pryde-helper-text">We'll never share your email</span>
          </div>
          
          {/* Textarea */}
          <div className="pryde-form-group">
            <label className="pryde-label">Message</label>
            <textarea 
              className="pryde-textarea" 
              placeholder="Write your message..."
            />
          </div>
          
          {/* Input with Error */}
          <div className="pryde-form-group">
            <label className="pryde-label">Username</label>
            <input 
              type="text" 
              className="pryde-input" 
              placeholder="Choose a username"
            />
            <span className="pryde-error-text">Username is already taken</span>
          </div>
          
          <button className="pryde-btn">Submit</button>
        </div>
      </section>

      {/* ========================================
          AVATARS & BADGES
          ======================================== */}
      <section className="mt-6">
        <h2 className="h2-section-title">Avatars & Badges</h2>
        
        <div className="flex items-center gap-4">
          <img src="/avatar.jpg" alt="User" className="pryde-avatar pryde-avatar-sm" />
          <img src="/avatar.jpg" alt="User" className="pryde-avatar pryde-avatar-md" />
          <img src="/avatar.jpg" alt="User" className="pryde-avatar pryde-avatar-lg" />
          <img src="/avatar.jpg" alt="User" className="pryde-avatar pryde-avatar-xl" />
        </div>
        
        <div className="flex gap-3 mt-4">
          <span className="pryde-badge">5</span>
          <span className="pryde-badge pryde-badge-danger">New</span>
          <span className="pryde-badge pryde-badge-success">✓</span>
          <span className="pryde-badge pryde-badge-warning">!</span>
          <span className="pryde-badge pryde-badge-secondary">Pro</span>
        </div>
      </section>

      {/* ========================================
          UTILITIES
          ======================================== */}
      <section className="mt-6">
        <h2 className="h2-section-title">Utility Classes</h2>
        
        <div className="pryde-card">
          <p className="text-bold">Bold text</p>
          <p className="text-muted">Muted text</p>
          <p className="text-small">Small text</p>
          <p className="text-tiny">Tiny text</p>
          
          <hr className="pryde-divider" />
          
          <div className="flex items-center justify-between">
            <span>Flexbox utilities</span>
            <span className="pryde-badge">✓</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DesignSystemExamples;

