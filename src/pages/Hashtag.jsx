import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import FormattedText from '../components/FormattedText';
import api from '../utils/api';
import { getImageUrl } from '../utils/imageUrl';
import PhotoViewer from '../components/PhotoViewer';
import './Feed.css';

function Hashtag() {
  const { tag } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [photoViewerImage, setPhotoViewerImage] = useState(null);

  useEffect(() => {
    fetchHashtagPosts();
  }, [tag]);

  const fetchHashtagPosts = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/search/hashtag/${tag}`);
      setPosts(response.data.posts);
    } catch (error) {
      console.error('Failed to fetch hashtag posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await api.post(`/posts/${postId}/like`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleShare = async (postId) => {
    try {
      await api.post(`/posts/${postId}/share`);
      alert('Post shared successfully!');
    } catch (error) {
      console.error('Failed to share post:', error);
    }
  };

  return (
    <div className="page-container">
      <Navbar onOpenMiniChat={onOpenMiniChat} />
      <div className="feed-container">
        <div className="feed-content">
          <div className="hashtag-header glossy">
            <h1 className="hashtag-title">#{tag}</h1>
            <p className="hashtag-subtitle">{posts.length} posts</p>
          </div>

          {loading ? (
            <div className="loading-spinner">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="no-posts glossy">
              <p>No posts found with #{tag}</p>
            </div>
          ) : (
            <div className="posts-list">
              {posts.map((post) => (
                <div key={post._id} className="post-card glossy">
                  <div className="post-header">
                    <Link to={`/profile/${post.author._id}`} className="post-author-link">
                      <div className="post-author-avatar">
                        {post.author.profilePhoto ? (
                          <img src={getImageUrl(post.author.profilePhoto)} alt={post.author.username} />
                        ) : (
                          <span>{post.author.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                        )}
                      </div>
                      <div className="post-author-info">
                        <div className="post-author-name">{post.author.displayName || post.author.username}</div>
                        <div className="post-timestamp">{new Date(post.createdAt).toLocaleDateString()}</div>
                      </div>
                    </Link>
                  </div>

                  {post.content && (
                    <div className="post-content">
                      <FormattedText text={post.content} />
                    </div>
                  )}

                  {post.media && post.media.length > 0 && (
                    <div className={`post-media-grid ${post.media.length > 1 ? 'multiple' : 'single'}`}>
                      {post.media.map((mediaItem, index) => (
                        <div key={index} className="post-media-item">
                          {mediaItem.type === 'image' ? (
                            <img 
                              src={getImageUrl(mediaItem.url)} 
                              alt="Post media" 
                              onClick={() => setPhotoViewerImage(getImageUrl(mediaItem.url))}
                            />
                          ) : (
                            <video src={getImageUrl(mediaItem.url)} controls />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="post-actions">
                    <button
                      className={`action-btn ${post.likes?.includes(localStorage.getItem('userId')) ? 'liked' : ''}`}
                      onClick={() => handleLike(post._id)}
                    >
                      <span>❤️</span> Like ({post.likes?.length || 0})
                    </button>
                    <button className="action-btn">
                      <span>💬</span> Comment ({post.comments?.length || 0})
                    </button>
                    <button className="action-btn" onClick={() => handleShare(post._id)}>
                      <span>🔗</span> Share ({post.shares?.length || 0})
                    </button>
                  </div>

                  {post.comments && post.comments.length > 0 && (
                    <div className="post-comments">
                      {post.comments.slice(-3).map((comment) => (
                        <div key={comment._id} className="comment">
                          <div className="comment-avatar">
                            {comment.user?.profilePhoto ? (
                              <img src={getImageUrl(comment.user.profilePhoto)} alt={comment.user.username} />
                            ) : (
                              <span>{comment.user?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                            )}
                          </div>
                          <div className="comment-content">
                            <div className="comment-author">{comment.user?.displayName || comment.user?.username}</div>
                            <div className="comment-text"><FormattedText text={comment.content} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {photoViewerImage && (
        <PhotoViewer imageUrl={photoViewerImage} onClose={() => setPhotoViewerImage(null)} />
      )}
    </div>
  );
}

export default Hashtag;

