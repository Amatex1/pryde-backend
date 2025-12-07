import { memo } from 'react';
import './PostSkeleton.css';

const PostSkeleton = memo(function PostSkeleton() {
  return (
    <div className="post-skeleton">
      <div className="skeleton-header">
        <div className="skeleton-avatar"></div>
        <div className="skeleton-user-info">
          <div className="skeleton-name"></div>
          <div className="skeleton-username"></div>
        </div>
      </div>
      <div className="skeleton-content">
        <div className="skeleton-text"></div>
        <div className="skeleton-text short"></div>
      </div>
      <div className="skeleton-actions">
        <div className="skeleton-button"></div>
        <div className="skeleton-button"></div>
        <div className="skeleton-button"></div>
      </div>
    </div>
  );
});

export default PostSkeleton;

