import './FeedSkeleton.css';

/**
 * FeedSkeleton - Full page skeleton for Feed
 * Shows predictable layout while data loads
 * Prevents layout shifts and UI popping
 */
function FeedSkeleton() {
  return (
    <div className="feed-skeleton">
      {/* Navbar Skeleton */}
      <div className="feed-skeleton-navbar">
        <div className="feed-skeleton-navbar-logo"></div>
        <div className="feed-skeleton-navbar-search"></div>
        <div className="feed-skeleton-navbar-actions">
          <div className="feed-skeleton-navbar-icon"></div>
          <div className="feed-skeleton-navbar-icon"></div>
          <div className="feed-skeleton-navbar-icon"></div>
          <div className="feed-skeleton-navbar-profile"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="feed-skeleton-main">
        {/* Left Sidebar Skeleton */}
        <div className="feed-skeleton-sidebar feed-skeleton-sidebar-left">
          <div className="feed-skeleton-sidebar-item"></div>
          <div className="feed-skeleton-sidebar-item"></div>
          <div className="feed-skeleton-sidebar-item"></div>
          <div className="feed-skeleton-sidebar-item"></div>
          <div className="feed-skeleton-sidebar-item"></div>
        </div>

        {/* Feed Content Skeleton */}
        <div className="feed-skeleton-content">
          {/* Composer Skeleton */}
          <div className="feed-skeleton-composer">
            <div className="feed-skeleton-composer-avatar"></div>
            <div className="feed-skeleton-composer-input"></div>
          </div>

          {/* Post Skeletons */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="feed-skeleton-post">
              <div className="feed-skeleton-post-header">
                <div className="feed-skeleton-post-avatar"></div>
                <div className="feed-skeleton-post-info">
                  <div className="feed-skeleton-post-name"></div>
                  <div className="feed-skeleton-post-time"></div>
                </div>
              </div>
              <div className="feed-skeleton-post-content">
                <div className="feed-skeleton-post-line"></div>
                <div className="feed-skeleton-post-line"></div>
                <div className="feed-skeleton-post-line short"></div>
              </div>
              <div className="feed-skeleton-post-actions">
                <div className="feed-skeleton-post-action"></div>
                <div className="feed-skeleton-post-action"></div>
                <div className="feed-skeleton-post-action"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Sidebar Skeleton */}
        <div className="feed-skeleton-sidebar feed-skeleton-sidebar-right">
          <div className="feed-skeleton-sidebar-card">
            <div className="feed-skeleton-sidebar-title"></div>
            <div className="feed-skeleton-sidebar-item"></div>
            <div className="feed-skeleton-sidebar-item"></div>
            <div className="feed-skeleton-sidebar-item"></div>
          </div>
          <div className="feed-skeleton-sidebar-card">
            <div className="feed-skeleton-sidebar-title"></div>
            <div className="feed-skeleton-sidebar-item"></div>
            <div className="feed-skeleton-sidebar-item"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeedSkeleton;

