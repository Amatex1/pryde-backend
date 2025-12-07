import { memo } from 'react';
import './ProfileSkeleton.css';

const ProfileSkeleton = memo(function ProfileSkeleton() {
  return (
    <div className="profile-skeleton">
      <div className="skeleton-cover"></div>
      <div className="skeleton-profile-info">
        <div className="skeleton-profile-avatar"></div>
        <div className="skeleton-profile-details">
          <div className="skeleton-profile-name"></div>
          <div className="skeleton-profile-username"></div>
          <div className="skeleton-profile-bio"></div>
          <div className="skeleton-profile-bio short"></div>
        </div>
      </div>
      <div className="skeleton-stats">
        <div className="skeleton-stat"></div>
        <div className="skeleton-stat"></div>
        <div className="skeleton-stat"></div>
      </div>
    </div>
  );
});

export default ProfileSkeleton;

