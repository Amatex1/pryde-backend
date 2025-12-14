import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PasskeyBanner from '../components/PasskeyBanner';
import ReportModal from '../components/ReportModal';
import PhotoViewer from '../components/PhotoViewer';
import CustomModal from '../components/CustomModal';
import ShareModal from '../components/ShareModal';
import ReactionDetailsModal from '../components/ReactionDetailsModal';
import FormattedText from '../components/FormattedText';
import PostSkeleton from '../components/PostSkeleton';
import OptimizedImage from '../components/OptimizedImage';
import CommentThread from '../components/CommentThread';
import GifPicker from '../components/GifPicker';
import PollCreator from '../components/PollCreator';
import Poll from '../components/Poll';
import PinnedPostBadge from '../components/PinnedPostBadge';
import EditHistoryModal from '../components/EditHistoryModal';
import DraftManager from '../components/DraftManager';
import { useModal } from '../hooks/useModal';
import api from '../utils/api';
import { getCurrentUser } from '../utils/auth';
import { getImageUrl } from '../utils/imageUrl';
import { onUserOnline, onUserOffline, onOnlineUsers, requestOnlineUsers, getSocket } from '../utils/socket';
import { convertEmojiShortcuts } from '../utils/textFormatting';
import logger from '../utils/logger';
import './Feed.css';

function Feed() {
  const [searchParams] = useSearchParams();
  const { modalState, closeModal, showAlert, showConfirm } = useModal();
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [reportModal, setReportModal] = useState({ isOpen: false, type: '', contentId: null, userId: null });
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [photoViewerImage, setPhotoViewerImage] = useState(null);
  const [showCommentBox, setShowCommentBox] = useState({});
  const [commentText, setCommentText] = useState({});
  const [commentGif, setCommentGif] = useState({});
  const [showGifPicker, setShowGifPicker] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyGif, setReplyGif] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostText, setEditPostText] = useState('');
  const [openCommentDropdownId, setOpenCommentDropdownId] = useState(null);
  const [postVisibility, setPostVisibility] = useState('followers');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [hiddenFromUsers, setHiddenFromUsers] = useState([]);
  const [sharedWithUsers, setSharedWithUsers] = useState([]);
  const [contentWarning, setContentWarning] = useState('');
  const [showContentWarning, setShowContentWarning] = useState(false);
  const [revealedPosts, setRevealedPosts] = useState({});
  const [showReplies, setShowReplies] = useState({}); // Track which comments have replies visible
  const [showReactionPicker, setShowReactionPicker] = useState(null); // Track which comment shows reaction picker
  const [postComments, setPostComments] = useState({}); // Store comments by postId { postId: [comments] }
  const [commentReplies, setCommentReplies] = useState({}); // Store replies by commentId { commentId: [replies] }
  const [editPostVisibility, setEditPostVisibility] = useState('friends');
  const [editHiddenFromUsers, setEditHiddenFromUsers] = useState([]);
  const [editSharedWithUsers, setEditSharedWithUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [unreadMessageCounts, setUnreadMessageCounts] = useState({});
  const [trending, setTrending] = useState([]);
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const [shareModal, setShareModal] = useState({ isOpen: false, post: null });
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [reactionDetailsModal, setReactionDetailsModal] = useState({ isOpen: false, reactions: [], likes: [] });
  const [feedFilter, setFeedFilter] = useState('followers'); // 'followers', 'public'
  const [poll, setPoll] = useState(null); // Poll data for new post
  const [showPollCreator, setShowPollCreator] = useState(false); // Show/hide poll creator
  const [showEditHistory, setShowEditHistory] = useState(false);
  const [editHistoryPostId, setEditHistoryPostId] = useState(null);
  const [hideMetrics, setHideMetrics] = useState(false); // Hide metrics for new post
  const [autoHideContentWarnings, setAutoHideContentWarnings] = useState(false);
  const [quietMode, setQuietMode] = useState(document.documentElement.getAttribute('data-quiet-mode') === 'true');
  const [initializing, setInitializing] = useState(true); // Track initial load
  const [showDraftManager, setShowDraftManager] = useState(false); // Show/hide draft manager
  const [currentDraftId, setCurrentDraftId] = useState(null); // Track current draft being edited
  const currentUser = getCurrentUser();
  const postRefs = useRef({});
  const commentRefs = useRef({});
  const listenersSetUpRef = useRef(false);
  const friendsIntervalRef = useRef(null); // Store interval ID for cleanup
  const autoSaveTimerRef = useRef(null); // Auto-save timer

  // Define all fetch functions BEFORE useEffects that use them
  const fetchPosts = useCallback(async () => {
    try {
      setFetchingPosts(true);
      const response = await api.get(`/posts?filter=${feedFilter}`);
      setPosts(response.data.posts || []);
    } catch (error) {
      logger.error('Failed to fetch posts:', error);
    } finally {
      setFetchingPosts(false);
    }
  }, [feedFilter]);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const response = await api.get('/blocks');
      const blockedIds = response.data.map(block => block.blocked._id);
      setBlockedUsers(blockedIds);
    } catch (error) {
      logger.error('Failed to fetch blocked users:', error);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data);
    } catch (error) {
      logger.error('Failed to fetch friends:', error);
    }
  }, []);

  const fetchTrending = useCallback(async () => {
    try {
      const response = await api.get('/search/trending');
      setTrending(response.data);
    } catch (error) {
      logger.error('Failed to fetch trending:', error);
    }
  }, []);

  const fetchBookmarkedPosts = useCallback(async () => {
    try {
      const response = await api.get('/bookmarks');
      setBookmarkedPosts(response.data.bookmarks.map(post => post._id));
    } catch (error) {
      logger.error('Failed to fetch bookmarks:', error);
    }
  }, []);

  const fetchUnreadMessageCounts = useCallback(async () => {
    try {
      const response = await api.get('/messages/unread/counts');
      const countsMap = {};
      response.data.unreadByUser.forEach(item => {
        countsMap[item.userId] = item.count;
      });
      setUnreadMessageCounts(countsMap);
    } catch (error) {
      logger.error('Failed to fetch unread message counts:', error);
    }
  }, []);

  const fetchPrivacySettings = useCallback(async () => {
    try {
      const response = await api.get('/privacy');
      setAutoHideContentWarnings(response.data.privacySettings.autoHideContentWarnings || false);
      // Set default post visibility from user's privacy settings
      const defaultVisibility = response.data.privacySettings.defaultPostVisibility || 'followers';
      setPostVisibility(defaultVisibility);
    } catch (error) {
      logger.error('Failed to fetch privacy settings:', error);
    }
  }, []);

  useEffect(() => {
    // Fetch all data in parallel for faster initial load
    // Use Promise.allSettled to continue even if some requests fail
    Promise.allSettled([
      fetchPosts(),
      fetchBlockedUsers(),
      fetchFriends(),
      fetchTrending(),
      fetchBookmarkedPosts(),
      fetchUnreadMessageCounts(),
      fetchPrivacySettings()
    ]).then(results => {
      // Log any failures but don't block the app
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const names = ['posts', 'blocked users', 'friends', 'trending', 'bookmarks', 'unread counts', 'privacy settings'];
          logger.warn(`Failed to load ${names[index]}:`, result.reason);
        }
      });

      // Mark initialization as complete
      setInitializing(false);
    }).catch(error => {
      logger.error('Error loading initial data:', error);
      // Don't throw - let the app continue with partial data
      setInitializing(false);
    });

    // Poll for unread message counts every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadMessageCounts().catch(err => {
        logger.warn('Failed to fetch unread counts:', err);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Listen for quiet mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const quiet = document.documentElement.getAttribute('data-quiet-mode') === 'true';
      setQuietMode(quiet);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-quiet-mode']
    });

    return () => observer.disconnect();
  }, []);

  // Refetch posts when filter changes
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.post-dropdown-container') && !event.target.closest('.comment-dropdown-container')) {
        setOpenDropdownId(null);
        setOpenCommentDropdownId(null);
      }
      // Close reaction picker when clicking outside
      if (!event.target.closest('.reaction-container')) {
        setShowReactionPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Socket listeners for online/offline status
  useEffect(() => {
    // Check if listeners are already set up (prevents duplicate setup in Strict Mode)
    if (listenersSetUpRef.current) {
      logger.debug('⚠️ Feed listeners already initialized, skipping setup');
      return;
    }

    let cleanupFunctions = [];

    const setupListeners = () => {
      logger.debug('🔌 Setting up online status listeners in Feed');

      // Get initial online users list
      const cleanupOnlineUsers = onOnlineUsers((users) => {
        logger.debug('📋 Received online users list:', users);
        setOnlineUsers(users);
      });
      cleanupFunctions.push(cleanupOnlineUsers);

      // Listen for users coming online
      const cleanupUserOnline = onUserOnline((data) => {
        logger.debug('✅ User came online:', data.userId);
        setOnlineUsers((prev) => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
        // Refresh friends list
        fetchFriends();
      });
      cleanupFunctions.push(cleanupUserOnline);

      // Listen for users going offline
      const cleanupUserOffline = onUserOffline((data) => {
        logger.debug('❌ User went offline:', data.userId);
        setOnlineUsers((prev) => prev.filter(id => id !== data.userId));
        // Refresh friends list
        fetchFriends();
      });
      cleanupFunctions.push(cleanupUserOffline);

      // Listen for real-time post reactions
      const socket = getSocket();
      if (socket) {
        const handlePostReaction = (data) => {
          logger.debug('💜 Real-time post reaction received:', data);
          setPosts((prevPosts) =>
            prevPosts.map(p => p._id === data.postId ? data.post : p)
          );
        };
        socket.on('post_reaction_added', handlePostReaction);
        cleanupFunctions.push(() => socket.off('post_reaction_added', handlePostReaction));

        // Listen for real-time comment reactions
        const handleCommentReactionRT = (data) => {
          logger.debug('💜 Real-time comment reaction received:', data);
          const updatedComment = data.comment;

          // Update in postComments
          setPostComments(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(postId => {
              updated[postId] = updated[postId].map(c =>
                c._id === updatedComment._id ? updatedComment : c
              );
            });
            return updated;
          });

          // Update in commentReplies
          setCommentReplies(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(parentId => {
              updated[parentId] = updated[parentId].map(c =>
                c._id === updatedComment._id ? updatedComment : c
              );
            });
            return updated;
          });
        };
        socket.on('comment_reaction_added', handleCommentReactionRT);
        cleanupFunctions.push(() => socket.off('comment_reaction_added', handleCommentReactionRT));

        // Listen for real-time comments
        const handleCommentAddedRT = (data) => {
          logger.debug('💬 Real-time comment received:', data);
          const newComment = data.comment;
          const postId = data.postId;

          if (newComment.parentCommentId) {
            // It's a reply
            setCommentReplies(prev => ({
              ...prev,
              [newComment.parentCommentId]: [...(prev[newComment.parentCommentId] || []), newComment]
            }));
          } else {
            // It's a top-level comment
            setPostComments(prev => ({
              ...prev,
              [postId]: [...(prev[postId] || []), newComment]
            }));
          }

          // Update post comment count
          setPosts(prevPosts =>
            prevPosts.map(p =>
              p._id === postId
                ? { ...p, commentCount: (p.commentCount || 0) + 1 }
                : p
            )
          );
        };
        socket.on('comment_added', handleCommentAddedRT);
        cleanupFunctions.push(() => socket.off('comment_added', handleCommentAddedRT));

        // Listen for comment updates
        const handleCommentUpdatedRT = (data) => {
          logger.debug('✏️ Real-time comment update received:', data);
          const updatedComment = data.comment;

          // Update in postComments
          setPostComments(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(postId => {
              updated[postId] = updated[postId].map(c =>
                c._id === updatedComment._id ? updatedComment : c
              );
            });
            return updated;
          });

          // Update in commentReplies
          setCommentReplies(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(parentId => {
              updated[parentId] = updated[parentId].map(c =>
                c._id === updatedComment._id ? updatedComment : c
              );
            });
            return updated;
          });
        };
        socket.on('comment_updated', handleCommentUpdatedRT);
        cleanupFunctions.push(() => socket.off('comment_updated', handleCommentUpdatedRT));

        // Listen for comment deletions
        const handleCommentDeletedRT = (data) => {
          logger.debug('🗑️ Real-time comment deletion received:', data);
          const { commentId, postId } = data;

          // Remove from postComments
          setPostComments(prev => ({
            ...prev,
            [postId]: (prev[postId] || []).filter(c => c._id !== commentId)
          }));

          // Remove from commentReplies
          setCommentReplies(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(parentId => {
              updated[parentId] = updated[parentId].filter(c => c._id !== commentId);
            });
            // Also remove if it was a parent
            delete updated[commentId];
            return updated;
          });

          // Update post comment count
          setPosts(prevPosts =>
            prevPosts.map(p =>
              p._id === postId
                ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) }
                : p
            )
          );
        };
        socket.on('comment_deleted', handleCommentDeletedRT);
        cleanupFunctions.push(() => socket.off('comment_deleted', handleCommentDeletedRT));
      }
    };

    // Mark as set up immediately to prevent duplicate setup
    listenersSetUpRef.current = true;

    // Try to get socket, retry if not available yet (max 50 retries = 5 seconds)
    let retryCount = 0;
    const maxRetries = 50;

    const checkSocket = () => {
      const socket = getSocket();

      if (!socket) {
        retryCount++;
        if (retryCount < maxRetries) {
          logger.debug(`⏳ Socket not initialized yet, retrying in 100ms... (${retryCount}/${maxRetries})`);
          setTimeout(checkSocket, 100);
        } else {
          logger.warn('⚠️ Socket initialization timed out after 5 seconds');
        }
        return;
      }

      logger.debug('✅ Socket found, checking connection status');

      // Set up listeners if already connected, or wait for connection
      if (socket.connected) {
        logger.debug('✅ Socket already connected, setting up listeners');
        setupListeners();
        // Request online users list (important for mobile/slow connections)
        setTimeout(() => requestOnlineUsers(), 500);
      } else {
        logger.debug('⏳ Socket not connected yet, waiting for connection...');
        const onConnect = () => {
          logger.debug('✅ Socket connected, setting up listeners');
          setupListeners();
          // Request online users list (important for mobile/slow connections)
          setTimeout(() => requestOnlineUsers(), 500);
        };
        socket.once('connect', onConnect);
      }
    };

    checkSocket();

    // Refresh friends list every 30 seconds
    friendsIntervalRef.current = setInterval(fetchFriends, 30000);

    return () => {
      if (friendsIntervalRef.current) {
        clearInterval(friendsIntervalRef.current);
        friendsIntervalRef.current = null;
      }
      // Clean up all socket listeners
      cleanupFunctions.forEach(cleanup => cleanup?.());
      // DON'T reset the flag - keep it true to prevent duplicate setup in React Strict Mode
    };
  }, [fetchFriends]);

  // Handle scrolling to specific post/comment from notifications
  useEffect(() => {
    const postId = searchParams.get('post');
    const commentId = searchParams.get('comment');

    if (postId && posts.length > 0) {
      // Wait for DOM to update
      setTimeout(() => {
        const postElement = postRefs.current[postId];
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          postElement.classList.add('highlighted-post');

          // Remove highlight after 3 seconds
          setTimeout(() => {
            postElement.classList.remove('highlighted-post');
          }, 3000);

          // If there's a specific comment, scroll to it
          if (commentId) {
            setTimeout(() => {
              const commentElement = commentRefs.current[commentId];
              if (commentElement) {
                commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                commentElement.classList.add('highlighted-comment');

                // Remove highlight after 3 seconds
                setTimeout(() => {
                  commentElement.classList.remove('highlighted-comment');
                }, 3000);
              }
            }, 500);
          }
        }
      }, 500);
    }
  }, [posts, searchParams]);

  // Helper function to format time since last seen
  const getTimeSince = (date) => {
    if (!date) return 'Unknown';
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));

    if (invalidFiles.length > 0) {
      showAlert('Please select only images (JPEG, PNG, GIF) or videos (MP4, WebM, OGG)', 'Invalid File Type');
      return;
    }

    // Limit to 3 files
    if (selectedMedia.length + files.length > 3) {
      showAlert('You can only upload up to 3 media files per post', 'Upload Limit Reached');
      return;
    }

    setUploadingMedia(true);
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('media', file);
      });

      const response = await api.post('/upload/post-media', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSelectedMedia([...selectedMedia, ...response.data.media]);
    } catch (error) {
      logger.error('Media upload failed:', error);
      showAlert('Failed to upload media. Please try again.', 'Upload Failed');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = (index) => {
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  // Auto-save draft
  const autoSaveDraft = useCallback(async () => {
    // Only auto-save if there's content
    if (!newPost.trim() && selectedMedia.length === 0) return;

    try {
      const draftData = {
        draftId: currentDraftId,
        draftType: 'post',
        content: newPost,
        media: selectedMedia,
        visibility: postVisibility,
        contentWarning: contentWarning,
        hideMetrics: hideMetrics,
        poll: poll
      };

      const response = await api.post('/drafts', draftData);

      // Set draft ID if this is a new draft
      if (!currentDraftId && response.data._id) {
        setCurrentDraftId(response.data._id);
      }
    } catch (error) {
      logger.error('Failed to auto-save draft:', error);
    }
  }, [newPost, selectedMedia, postVisibility, contentWarning, hideMetrics, poll, currentDraftId]);

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveDraft();
    }, 3000); // Auto-save after 3 seconds of inactivity

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [newPost, selectedMedia, postVisibility, contentWarning, hideMetrics, poll, autoSaveDraft]);

  // Restore draft
  const handleRestoreDraft = (draft) => {
    setNewPost(draft.content || '');
    setSelectedMedia(draft.media || []);
    setPostVisibility(draft.visibility || 'followers');
    setContentWarning(draft.contentWarning || '');
    setHideMetrics(draft.hideMetrics || false);
    setPoll(draft.poll || null);
    setCurrentDraftId(draft._id);
    setShowContentWarning(!!draft.contentWarning);
    setShowPollCreator(!!draft.poll);
  };

  // Delete draft after successful post
  const deleteDraft = async (draftId) => {
    if (!draftId) return;
    try {
      await api.delete(`/drafts/${draftId}`);
    } catch (error) {
      logger.error('Failed to delete draft:', error);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && selectedMedia.length === 0) {
      showAlert('Please add some content or media to your post', 'Empty Post');
      return;
    }

    setLoading(true);
    try {
      // Convert emoji shortcuts before posting
      const contentWithEmojis = convertEmojiShortcuts(newPost);

      const postData = {
        content: contentWithEmojis,
        media: selectedMedia,
        visibility: postVisibility,
        contentWarning: contentWarning,
        poll: poll, // Include poll data if present
        hideMetrics: hideMetrics // Include hideMetrics setting
      };

      // PHASE 1 REFACTOR: Custom privacy removed
      // if (postVisibility === 'custom') {
      //   if (hiddenFromUsers.length > 0) {
      //     postData.hiddenFrom = hiddenFromUsers;
      //   }
      //   if (sharedWithUsers.length > 0) {
      //     postData.sharedWith = sharedWithUsers;
      //   }
      // }

      const response = await api.post('/posts', postData);
      setPosts([response.data, ...posts]);

      // Delete draft after successful post
      if (currentDraftId) {
        await deleteDraft(currentDraftId);
        setCurrentDraftId(null);
      }

      setNewPost('');
      setSelectedMedia([]);
      setPostVisibility('followers');
      setHiddenFromUsers([]);
      setSharedWithUsers([]);
      setContentWarning('');
      setShowContentWarning(false);
      setPoll(null);
      setShowPollCreator(false);
      setHideMetrics(false);
    } catch (error) {
      logger.error('Post creation failed:', error);
      showAlert('Failed to create post. Please try again.', 'Post Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await api.post(`/posts/${postId}/like`);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
    } catch (error) {
      logger.error('Failed to like post:', error);
    }
  };

  const handlePostReaction = async (postId, emoji) => {
    try {
      const response = await api.post(`/posts/${postId}/react`, { emoji });
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setShowReactionPicker(null); // Hide picker after reaction
    } catch (error) {
      logger.error('Failed to react to post:', error);
    }
  };

  // Helper function to get user's selected emoji from reactions object
  const getUserReactionEmoji = (reactions) => {
    if (!reactions || !currentUser?.id) return null;

    for (const [emoji, userIds] of Object.entries(reactions)) {
      if (userIds.includes(currentUser.id)) {
        return emoji;
      }
    }
    return null;
  };

  // Fetch comments for a post
  const fetchCommentsForPost = async (postId) => {
    try {
      const response = await api.get(`/posts/${postId}/comments`);
      setPostComments(prev => ({
        ...prev,
        [postId]: response.data
      }));
    } catch (error) {
      logger.error('Failed to fetch comments:', error);
    }
  };

  // Fetch replies for a comment
  const fetchRepliesForComment = async (commentId) => {
    try {
      const response = await api.get(`/comments/${commentId}/replies`);
      setCommentReplies(prev => ({
        ...prev,
        [commentId]: response.data
      }));
    } catch (error) {
      logger.error('Failed to fetch replies:', error);
    }
  };

  // Toggle replies visibility and fetch if needed
  const toggleReplies = async (commentId) => {
    const isCurrentlyShown = showReplies[commentId];

    setShowReplies(prev => ({
      ...prev,
      [commentId]: !isCurrentlyShown
    }));

    // Fetch replies if showing and not already loaded
    if (!isCurrentlyShown && !commentReplies[commentId]) {
      await fetchRepliesForComment(commentId);
    }
  };

  const handleCommentReaction = async (commentId, emoji) => {
    try {
      // Optimistic update
      const updateCommentReaction = (comment) => {
        if (comment._id !== commentId) return comment;

        const reactions = { ...comment.reactions };
        const currentUserId = currentUser?.id;

        // Remove user from all emoji arrays
        Object.keys(reactions).forEach(key => {
          reactions[key] = reactions[key].filter(uid => uid !== currentUserId);
        });

        // Add user to selected emoji array (or remove if clicking same emoji)
        const hadThisReaction = comment.reactions?.[emoji]?.includes(currentUserId);
        if (!hadThisReaction) {
          if (!reactions[emoji]) reactions[emoji] = [];
          reactions[emoji].push(currentUserId);
        }

        return { ...comment, reactions };
      };

      // Update in postComments
      setPostComments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(postId => {
          updated[postId] = updated[postId].map(updateCommentReaction);
        });
        return updated;
      });

      // Update in commentReplies
      setCommentReplies(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(parentId => {
          updated[parentId] = updated[parentId].map(updateCommentReaction);
        });
        return updated;
      });

      // Make API call
      const response = await api.post(`/comments/${commentId}/react`, { emoji });

      // Update with server response
      const serverComment = response.data;
      setPostComments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(postId => {
          updated[postId] = updated[postId].map(c =>
            c._id === commentId ? serverComment : c
          );
        });
        return updated;
      });

      setCommentReplies(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(parentId => {
          updated[parentId] = updated[parentId].map(c =>
            c._id === commentId ? serverComment : c
          );
        });
        return updated;
      });

      setShowReactionPicker(null);
    } catch (error) {
      logger.error('Failed to react to comment:', error);
      // Revert optimistic update on error
      // Re-fetch to get correct state
    }
  };

  const toggleCommentBox = async (postId) => {
    const isCurrentlyShown = showCommentBox[postId];

    setShowCommentBox(prev => ({
      ...prev,
      [postId]: !isCurrentlyShown
    }));

    // Fetch comments if opening and not already loaded
    if (!isCurrentlyShown && !postComments[postId]) {
      await fetchCommentsForPost(postId);
    }
  };

  const handleCommentSubmit = async (postId, e) => {
    e.preventDefault();
    const content = commentText[postId];
    const gifUrl = commentGif[postId];

    // Either content or GIF must be provided
    if ((!content || !content.trim()) && !gifUrl) return;

    try {
      // Convert emoji shortcuts before posting
      const contentWithEmojis = content ? convertEmojiShortcuts(content) : '';

      const response = await api.post(`/posts/${postId}/comments`, {
        content: contentWithEmojis,
        gifUrl: gifUrl || null,
        parentCommentId: null // Top-level comment
      });

      // Add new comment to postComments
      setPostComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), response.data]
      }));

      // Update post comment count
      setPosts(posts.map(p =>
        p._id === postId
          ? { ...p, commentCount: (p.commentCount || 0) + 1 }
          : p
      ));

      setCommentText(prev => ({ ...prev, [postId]: '' }));
      setCommentGif(prev => ({ ...prev, [postId]: null }));
    } catch (error) {
      logger.error('Failed to comment:', error);
      showAlert('Failed to add comment. Please try again.', 'Comment Failed');
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentText(prev => ({ ...prev, [postId]: value }));
  };

  const handleEditComment = (commentId, content) => {
    setEditingCommentId(commentId);
    setEditCommentText(content);
  };

  const handleSaveEditComment = async (commentId) => {
    if (!editCommentText.trim()) return;

    try {
      const response = await api.put(`/comments/${commentId}`, {
        content: editCommentText
      });

      const updatedComment = response.data;

      // Update in postComments
      setPostComments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(postId => {
          updated[postId] = updated[postId].map(c =>
            c._id === commentId ? updatedComment : c
          );
        });
        return updated;
      });

      // Update in commentReplies
      setCommentReplies(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(parentId => {
          updated[parentId] = updated[parentId].map(c =>
            c._id === commentId ? updatedComment : c
          );
        });
        return updated;
      });

      setEditingCommentId(null);
      setEditCommentText('');
    } catch (error) {
      logger.error('Failed to edit comment:', error);
      showAlert('Failed to edit comment. Please try again.', 'Edit Failed');
    }
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const toggleDropdown = (postId) => {
    setOpenDropdownId(openDropdownId === postId ? null : postId);
  };

  const handleEditPost = (post) => {
    setEditingPostId(post._id);
    setEditPostText(post.content);
    setEditPostVisibility(post.visibility || 'friends');
    setEditHiddenFromUsers(post.hiddenFrom?.map(u => u._id || u) || []);
    setEditSharedWithUsers(post.sharedWith?.map(u => u._id || u) || []);
    setOpenDropdownId(null);
  };

  const handleSaveEditPost = async (postId) => {
    if (!editPostText.trim()) return;

    try {
      const updateData = {
        content: editPostText,
        visibility: editPostVisibility
      };

      // Add custom privacy settings if applicable
      if (editPostVisibility === 'custom') {
        if (editHiddenFromUsers.length > 0) {
          updateData.hiddenFrom = editHiddenFromUsers;
        }
        if (editSharedWithUsers.length > 0) {
          updateData.sharedWith = editSharedWithUsers;
        }
      } else {
        // Clear custom privacy if not using custom visibility
        updateData.hiddenFrom = [];
        updateData.sharedWith = [];
      }

      const response = await api.put(`/posts/${postId}`, updateData);
      setPosts(posts.map(p => p._id === postId ? response.data : p));
      setEditingPostId(null);
      setEditPostText('');
      setEditPostVisibility('friends');
      setEditHiddenFromUsers([]);
      setEditSharedWithUsers([]);
      showAlert('Post updated successfully!', 'Success');
    } catch (error) {
      logger.error('Failed to edit post:', error);
      showAlert('Failed to edit post. Please try again.', 'Edit Failed');
    }
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
    setEditPostText('');
    setEditPostVisibility('friends');
    setEditHiddenFromUsers([]);
    setEditSharedWithUsers([]);
  };

  const handleDeleteComment = async (postId, commentId, isReply = false) => {
    const confirmed = await showConfirm('Are you sure you want to delete this comment?', 'Delete Comment', 'Delete', 'Cancel');
    if (!confirmed) return;

    try {
      await api.delete(`/comments/${commentId}`);

      if (isReply) {
        // Remove from commentReplies
        setCommentReplies(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(parentId => {
            updated[parentId] = updated[parentId].filter(c => c._id !== commentId);
          });
          return updated;
        });
      } else {
        // Remove from postComments (and all its replies will be deleted by backend)
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(c => c._id !== commentId)
        }));

        // Remove replies from state
        setCommentReplies(prev => {
          const updated = { ...prev };
          delete updated[commentId];
          return updated;
        });
      }

      // Update post comment count
      setPosts(posts.map(p =>
        p._id === postId
          ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) }
          : p
      ));
    } catch (error) {
      logger.error('Failed to delete comment:', error);
      showAlert('Failed to delete comment. Please try again.', 'Delete Failed');
    }
  };

  const handleReplyToComment = (postId, commentId) => {
    setReplyingToComment({ postId, commentId });
    setReplyText('');
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();

    // Either text or GIF must be provided
    if ((!replyText || !replyText.trim()) && !replyGif) return;
    if (!replyingToComment) return;

    try {
      const { postId, commentId } = replyingToComment;
      // Convert emoji shortcuts before posting
      const contentWithEmojis = replyText ? convertEmojiShortcuts(replyText) : '';

      const response = await api.post(`/posts/${postId}/comments`, {
        content: contentWithEmojis,
        gifUrl: replyGif || null,
        parentCommentId: commentId // This makes it a reply
      });

      const newReply = response.data;

      // Add reply to commentReplies
      setCommentReplies(prev => ({
        ...prev,
        [commentId]: [...(prev[commentId] || []), newReply]
      }));

      // Update parent comment's reply count
      setPostComments(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(pId => {
          updated[pId] = updated[pId].map(c =>
            c._id === commentId
              ? { ...c, replyCount: (c.replyCount || 0) + 1 }
              : c
          );
        });
        return updated;
      });

      // Update post comment count
      setPosts(posts.map(p =>
        p._id === postId
          ? { ...p, commentCount: (p.commentCount || 0) + 1 }
          : p
      ));

      setReplyingToComment(null);
      setReplyText('');
      setReplyGif(null);

      // Auto-show replies after adding one
      setShowReplies(prev => ({
        ...prev,
        [commentId]: true
      }));
    } catch (error) {
      logger.error('Failed to reply to comment:', error);
      showAlert('Failed to reply. Please try again.', 'Reply Failed');
    }
  };

  const handleCancelReply = () => {
    setReplyingToComment(null);
    setReplyText('');
    setReplyGif(null);
  };

  const handleShare = (post) => {
    setShareModal({ isOpen: true, post });
  };

  const handleShareComplete = async () => {
    try {
      const response = await api.post(`/posts/${shareModal.post._id}/share`);
      setPosts(posts.map(p => p._id === shareModal.post._id ? response.data : p));
      showAlert('Post shared successfully!', 'Shared');
    } catch (error) {
      logger.error('Failed to share post:', error);
      showAlert(error.response?.data?.message || 'Failed to share post.', 'Share Failed');
    }
  };

  const handleBookmark = async (postId) => {
    const isBookmarked = bookmarkedPosts.includes(postId);

    try {
      if (isBookmarked) {
        await api.delete(`/bookmarks/${postId}`);
        setBookmarkedPosts(bookmarkedPosts.filter(id => id !== postId));
      } else {
        await api.post(`/bookmarks/${postId}`);
        setBookmarkedPosts([...bookmarkedPosts, postId]);
      }
    } catch (error) {
      logger.error('Failed to bookmark post:', error);
      showAlert(error.response?.data?.message || 'Failed to bookmark post.', 'Bookmark Failed');
    }
  };

  const handleDelete = async (postId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this post?', 'Delete Post', 'Delete', 'Cancel');
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/posts/${postId}`);
      setPosts(posts.filter(p => p._id !== postId));
    } catch (error) {
      logger.error('Failed to delete post:', error);
      showAlert('Failed to delete post. Please try again.', 'Delete Failed');
    }
  };

  return (
    <div className="page-container feed-page">
      <Navbar />
      <PasskeyBanner />

      <div className="feed-container">
        <div className="feed-content">
          <div className="create-post glossy fade-in">
            <h2 className="section-title">✨ Share a thought...</h2>
            <form onSubmit={handlePostSubmit}>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What are you reflecting on today?"
                className="post-input glossy"
                rows="4"
              />

              {selectedMedia.length > 0 && (
                <div className="media-preview">
                  {selectedMedia.map((media, index) => (
                    <div key={index} className="media-preview-item">
                      {media.type === 'video' ? (
                        <video src={getImageUrl(media.url)} controls />
                      ) : (
                        <img src={getImageUrl(media.url)} alt={`Upload ${index + 1}`} />
                      )}
                      <button
                        type="button"
                        className="remove-media"
                        onClick={() => removeMedia(index)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showContentWarning && (
                <div className="content-warning-input">
                  <select
                    value={contentWarning}
                    onChange={(e) => setContentWarning(e.target.value)}
                    className="cw-input glossy"
                  >
                    <option value="">Select a content warning...</option>
                    <option value="Mental Health">Mental Health</option>
                    <option value="Violence">Violence</option>
                    <option value="Sexual Content">Sexual Content</option>
                    <option value="Substance Use">Substance Use</option>
                    <option value="Self-Harm">Self-Harm</option>
                    <option value="Death/Grief">Death/Grief</option>
                    <option value="Eating Disorders">Eating Disorders</option>
                    <option value="Abuse">Abuse</option>
                    <option value="Discrimination">Discrimination</option>
                    <option value="Medical Content">Medical Content</option>
                    <option value="Flashing Lights">Flashing Lights</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              {/* Poll Creator */}
              {showPollCreator && (
                <PollCreator
                  onPollChange={setPoll}
                  initialPoll={poll}
                />
              )}

              <div className="post-actions-bar">
                <label className="btn-media-upload">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleMediaSelect}
                    disabled={uploadingMedia || selectedMedia.length >= 3}
                    style={{ display: 'none' }}
                  />
                  {uploadingMedia ? '⏳ Uploading...' : '📷 Add Photos/Videos'}
                </label>

                <button
                  type="button"
                  className={`btn-poll ${showPollCreator ? 'active' : ''}`}
                  onClick={() => setShowPollCreator(!showPollCreator)}
                  title="Add poll"
                >
                  📊 Poll
                </button>

                <button
                  type="button"
                  className={`btn-content-warning ${showContentWarning ? 'active' : ''}`}
                  onClick={() => setShowContentWarning(!showContentWarning)}
                  title="Add content warning"
                >
                  ⚠️ CW
                </button>

                <label className="hide-metrics-checkbox" title="Hide likes, comments, and shares count">
                  <input
                    type="checkbox"
                    checked={hideMetrics}
                    onChange={(e) => setHideMetrics(e.target.checked)}
                  />
                  <span>🔇 Hide Metrics</span>
                </label>

                {/* PHASE 1 REFACTOR: Simplified privacy options */}
                <label htmlFor="post-privacy-selector" style={{ display: 'none' }}>
                  Post Privacy
                </label>
                <select
                  id="post-privacy-selector"
                  value={postVisibility}
                  onChange={(e) => setPostVisibility(e.target.value)}
                  className="privacy-selector glossy"
                  aria-label="Select post privacy"
                >
                  <option value="public">🌍 Public</option>
                  <option value="followers">👥 Connections</option>
                  <option value="private">🔒 Private</option>
                </select>

                <button
                  type="button"
                  className="btn-drafts"
                  onClick={() => setShowDraftManager(true)}
                  title="View saved drafts"
                >
                  📝 Drafts
                </button>

                <button type="submit" disabled={loading || uploadingMedia} className="btn-post glossy-gold">
                  {loading ? 'Publishing...' : 'Publish ✨'}
                </button>
              </div>
            </form>
          </div>

          {/* Draft Manager Modal */}
          {showDraftManager && (
            <div className="modal-overlay" onClick={() => setShowDraftManager(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <DraftManager
                  draftType="post"
                  onRestoreDraft={handleRestoreDraft}
                  onClose={() => setShowDraftManager(false)}
                />
              </div>
            </div>
          )}

          {/* Feed Filter Tabs */}
          <div className="feed-tabs glossy">
            <button
              className={`feed-tab ${feedFilter === 'followers' ? 'active' : ''}`}
              onClick={() => setFeedFilter('followers')}
            >
              <span className="tab-icon">👥</span>
              <span className="tab-label">Following</span>
            </button>
            <button
              className={`feed-tab ${feedFilter === 'public' ? 'active' : ''}`}
              onClick={() => setFeedFilter('public')}
            >
              <span className="tab-icon">🌍</span>
              <span className="tab-label">Everyone</span>
            </button>
          </div>

          <div className="posts-list">
            {fetchingPosts ? (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            ) : posts.length === 0 ? (
              <div className="empty-state glossy">
                <h3>No posts yet</h3>
                <p>
                  {feedFilter === 'followers'
                    ? 'Follow some users to see their posts here!'
                    : 'No public posts available yet.'}
                </p>
              </div>
            ) : (
              posts
                .filter(post => !blockedUsers.includes(post.author?._id))
                .map((post, postIndex) => {
                // PHASE 1 REFACTOR: Use hasLiked boolean instead of checking likes array
                const isLiked = post.hasLiked || false;
                const isFirstPost = postIndex === 0;

                return (
                  <div
                    key={post._id}
                    className="post-card glossy fade-in"
                    ref={(el) => postRefs.current[post._id] = el}
                  >
                    <div className="post-header">
                      {/* Pinned Post Badge */}
                      {post.isPinned && <PinnedPostBadge />}

                      <div className="post-author">
                        <Link
                          to={`/profile/${post.author?.username}`}
                          className="author-avatar"
                          style={{ textDecoration: 'none' }}
                          aria-label={`View ${post.author?.displayName || post.author?.username}'s profile`}
                        >
                          {post.author?.profilePhoto ? (
                            <OptimizedImage
                              src={getImageUrl(post.author.profilePhoto)}
                              alt={post.author.username}
                              className="avatar-image"
                            />
                          ) : (
                            <span>{post.author?.displayName?.charAt(0).toUpperCase() || post.author?.username?.charAt(0).toUpperCase() || 'U'}</span>
                          )}
                        </Link>
                        <div className="author-info">
                          <div className="author-name-row">
                            <Link to={`/profile/${post.author?.username}`} className="author-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                              {post.author?.displayName || post.author?.username || 'User'}
                            </Link>
                            {post.author?.isVerified && <span className="verified-badge" title="Verified">✓</span>}
                            {post.author?.pronouns && (
                              <span className="author-pronouns">({post.author.pronouns})</span>
                            )}
                          </div>
                          <div className="post-time">
                            {new Date(post.createdAt).toLocaleDateString()}
                            <span className="post-privacy-icon" title={`Visible to: ${post.visibility || 'followers'}`}>
                              {post.visibility === 'public' ? '🌍' :
                               post.visibility === 'private' ? '🔒' :
                               post.visibility === 'followers' ? '👥' :
                               post.visibility === 'friends' ? '👫' : '👥'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="post-header-actions">
                        <div className="post-dropdown-container">
                          <button
                            className="btn-dropdown"
                            onClick={() => toggleDropdown(post._id)}
                            title="More options"
                          >
                            ⋮
                          </button>
                          {openDropdownId === post._id && (
                            <div className="dropdown-menu">
                              {(post.author?._id === currentUser?.id || post.author?._id === currentUser?._id) ? (
                                <>
                                  <button
                                    className="dropdown-item"
                                    onClick={async () => {
                                      try {
                                        const response = await api.post(`/posts/${post._id}/pin`);
                                        setPosts(posts.map(p => p._id === post._id ? response.data : p));
                                        setOpenDropdownId(null);
                                      } catch (error) {
                                        logger.error('Failed to toggle pin:', error);
                                      }
                                    }}
                                  >
                                    📌 {post.isPinned ? 'Unpin' : 'Pin to Profile'}
                                  </button>
                                  {post.edited && (
                                    <button
                                      className="dropdown-item"
                                      onClick={() => {
                                        setEditHistoryPostId(post._id);
                                        setShowEditHistory(true);
                                        setOpenDropdownId(null);
                                      }}
                                    >
                                      📜 View Edit History
                                    </button>
                                  )}
                                  {!post.isShared && (
                                    <button
                                      className="dropdown-item"
                                      onClick={() => handleEditPost(post)}
                                    >
                                      ✏️ Edit
                                    </button>
                                  )}
                                  <button
                                    className="dropdown-item delete"
                                    onClick={() => {
                                      handleDelete(post._id);
                                      setOpenDropdownId(null);
                                    }}
                                  >
                                    🗑️ Delete
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="dropdown-item report"
                                  onClick={() => {
                                    setReportModal({ isOpen: true, type: 'post', contentId: post._id, userId: post.author?._id });
                                    setOpenDropdownId(null);
                                  }}
                                >
                                  🚩 Report
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="post-content">
                      {/* Show "X shared X's post" if this is a shared post */}
                      {post.isShared && post.originalPost && (
                        <div style={{
                          marginBottom: '1rem',
                          padding: '0.5rem 0.75rem',
                          background: 'var(--soft-lavender)',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          color: 'var(--text-main)'
                        }}>
                          <strong>{post.author?.displayName || post.author?.username}</strong> shared{' '}
                          <strong>{post.originalPost.author?.displayName || post.originalPost.author?.username}'s</strong> post
                        </div>
                      )}

                      {/* Show share comment if this is a shared post */}
                      {post.isShared && post.shareComment && (
                        <p style={{ marginBottom: '1rem', fontStyle: 'italic' }}>
                          {post.shareComment}
                        </p>
                      )}

                      {/* Show original post if this is a shared post */}
                      {post.isShared && post.originalPost ? (
                        <div className="shared-post-container" style={{
                          border: '2px solid var(--soft-lavender)',
                          borderRadius: '12px',
                          padding: '1rem',
                          marginTop: '0.5rem',
                          background: 'var(--background-light)'
                        }}>
                          <div className="shared-post-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div className="author-avatar" style={{ width: '32px', height: '32px' }}>
                              {post.originalPost.author?.profilePhoto ? (
                                <OptimizedImage
                                  src={getImageUrl(post.originalPost.author.profilePhoto)}
                                  alt={post.originalPost.author.username}
                                  className="avatar-image"
                                />
                              ) : (
                                <span>{post.originalPost.author?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                {post.originalPost.author?.displayName || post.originalPost.author?.username}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {new Date(post.originalPost.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          {post.originalPost.content && <p>{post.originalPost.content}</p>}
                          {post.originalPost.media && post.originalPost.media.length > 0 && (
                            <div className={`post-media-grid ${post.originalPost.media.length === 1 ? 'single' : post.originalPost.media.length === 2 ? 'double' : 'multiple'}`}>
                              {post.originalPost.media.map((media, index) => (
                                <div key={index} className="post-media-item">
                                  {media.type === 'video' ? (
                                    <video src={getImageUrl(media.url)} controls />
                                  ) : (
                                    <OptimizedImage
                                      src={getImageUrl(media.url)}
                                      alt={`Shared post media ${index + 1}`}
                                      onClick={() => setPhotoViewerImage(getImageUrl(media.url))}
                                      style={{ cursor: 'pointer' }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {editingPostId === post._id ? (
                            <div className="post-edit-box">
                              <textarea
                                value={editPostText}
                                onChange={(e) => setEditPostText(e.target.value)}
                                className="post-edit-textarea"
                                autoFocus
                                rows="4"
                              />
                              <div className="post-edit-privacy">
                                <label
                                  htmlFor="edit-post-privacy-selector"
                                  style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}
                                >
                                  Privacy:
                                </label>
                                {/* PHASE 1 REFACTOR: Simplified privacy options */}
                                <select
                                  id="edit-post-privacy-selector"
                                  value={editPostVisibility}
                                  onChange={(e) => setEditPostVisibility(e.target.value)}
                                  className="privacy-selector glossy"
                                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                                  aria-label="Edit post privacy"
                                >
                                  <option value="public">🌍 Public</option>
                                  <option value="followers">👥 Connections</option>
                                  <option value="private">🔒 Private</option>
                                </select>
                              </div>
                              <div className="post-edit-actions">
                                <button
                                  onClick={() => handleSaveEditPost(post._id)}
                                  className="btn-save-post"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEditPost}
                                  className="btn-cancel-post"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {post.contentWarning && !revealedPosts[post._id] && autoHideContentWarnings ? (
                                <div className="content-warning-overlay">
                                  <div className="cw-header">
                                    <span className="cw-icon">⚠️</span>
                                    <span className="cw-text">Content Warning: {post.contentWarning}</span>
                                  </div>
                                  <button
                                    className="btn-reveal-content"
                                    onClick={() => setRevealedPosts({...revealedPosts, [post._id]: true})}
                                  >
                                    Show Content
                                  </button>
                                </div>
                              ) : (
                                post.content && (
                                  <p>
                                    <FormattedText text={post.content} />
                                  </p>
                                )
                              )}
                            </>
                          )}

                          {post.media && post.media.length > 0 && (!post.contentWarning || !autoHideContentWarnings || revealedPosts[post._id]) && (
                            <div className={`post-media-grid ${post.media.length === 1 ? 'single' : post.media.length === 2 ? 'double' : 'multiple'}`}>
                              {post.media.map((media, index) => (
                                <div key={index} className="post-media-item">
                                  {media.type === 'video' ? (
                                    <video src={getImageUrl(media.url)} controls />
                                  ) : (
                                    <OptimizedImage
                                      src={getImageUrl(media.url)}
                                      alt={`Post media ${index + 1}`}
                                      onClick={() => setPhotoViewerImage(getImageUrl(media.url))}
                                      style={{ cursor: 'pointer' }}
                                      fetchPriority={isFirstPost && index === 0 ? 'high' : undefined}
                                      loading={isFirstPost && index === 0 ? 'eager' : 'lazy'}
                                      responsiveSizes={media.sizes}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Poll Component */}
                          {post.poll && (
                            <Poll
                              poll={post.poll}
                              postId={post._id}
                              currentUserId={currentUser?._id}
                              onVote={(updatedPost) => {
                                setPosts(posts.map(p => p._id === updatedPost._id ? updatedPost : p));
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>

                    <div className="post-actions">
                      <div className="reaction-container">
                        <button
                          className={`action-btn ${isLiked || post.reactions?.some(r => r.user?._id === currentUser?.id || r.user === currentUser?.id) ? 'liked' : ''}`}
                          onClick={() => {
                            // Click to react with default emoji (heart)
                            handlePostReaction(post._id, '❤️');
                          }}
                          onMouseEnter={() => {
                            // Hover shows emoji picker on desktop
                            if (window.innerWidth > 768) {
                              setShowReactionPicker(`post-${post._id}`);
                            }
                          }}
                          onMouseLeave={() => {
                            // Delay hiding to allow moving to picker
                            if (window.innerWidth > 768) {
                              setTimeout(() => {
                                if (showReactionPicker === `post-${post._id}`) {
                                  setShowReactionPicker(null);
                                }
                              }, 300);
                            }
                          }}
                          onTouchStart={(e) => {
                            // Long press shows emoji picker on mobile
                            const touchTimer = setTimeout(() => {
                              setShowReactionPicker(`post-${post._id}`);
                            }, 500);
                            e.currentTarget.dataset.touchTimer = touchTimer;
                          }}
                          onTouchEnd={(e) => {
                            // Clear long press timer
                            if (e.currentTarget.dataset.touchTimer) {
                              clearTimeout(e.currentTarget.dataset.touchTimer);
                            }
                          }}
                        >
                          <span>
                            {getUserReactionEmoji(post.reactions) || '🤍'}
                          </span> {getUserReactionEmoji(post.reactions) ? 'Reacted' : 'React'}
                        </button>
                        {showReactionPicker === `post-${post._id}` && (
                          <div
                            className="reaction-picker"
                            onMouseEnter={() => {
                              if (window.innerWidth > 768) {
                                setShowReactionPicker(`post-${post._id}`);
                              }
                            }}
                            onMouseLeave={() => {
                              if (window.innerWidth > 768) {
                                setTimeout(() => {
                                  setShowReactionPicker(null);
                                }, 300);
                              }
                            }}
                          >
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '👍'); setShowReactionPicker(null); }} title="Like">👍</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '❤️'); setShowReactionPicker(null); }} title="Love">❤️</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '😂'); setShowReactionPicker(null); }} title="Haha">😂</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '😮'); setShowReactionPicker(null); }} title="Wow">😮</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '😢'); setShowReactionPicker(null); }} title="Sad">😢</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '😡'); setShowReactionPicker(null); }} title="Angry">😡</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '🤗'); setShowReactionPicker(null); }} title="Care">🤗</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '🎉'); setShowReactionPicker(null); }} title="Celebrate">🎉</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '🤔'); setShowReactionPicker(null); }} title="Think">🤔</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '🔥'); setShowReactionPicker(null); }} title="Fire">🔥</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '👏'); setShowReactionPicker(null); }} title="Clap">👏</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '🤯'); setShowReactionPicker(null); }} title="Mind Blown">🤯</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '🏳️‍🌈'); setShowReactionPicker(null); }} title="Pride">🏳️‍🌈</button>
                            <button className="reaction-btn" onClick={() => { handlePostReaction(post._id, '🏳️‍⚧️'); setShowReactionPicker(null); }} title="Trans Pride">🏳️‍⚧️</button>
                          </div>
                        )}
                      </div>
                      {!quietMode && !post.hideMetrics && post.reactions?.length > 0 && (
                        <button
                          className="reaction-count-btn"
                          onClick={() => setReactionDetailsModal({
                            isOpen: true,
                            reactions: post.reactions || [],
                            likes: []
                          })}
                        >
                          {post.reactions.length}
                        </button>
                      )}
                      <button
                        className="action-btn"
                        onClick={() => toggleCommentBox(post._id)}
                      >
                        <span>💬</span> Comment {!post.hideMetrics && `(${post.comments?.length || 0})`}
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => handleShare(post)}
                      >
                        <span>🔗</span> Share {!post.hideMetrics && `(${post.shares?.length || 0})`}
                      </button>
                      <button
                        className={`action-btn ${bookmarkedPosts.includes(post._id) ? 'bookmarked' : ''}`}
                        onClick={() => handleBookmark(post._id)}
                        title={bookmarkedPosts.includes(post._id) ? 'Remove bookmark' : 'Bookmark post'}
                      >
                        <span>{bookmarkedPosts.includes(post._id) ? '🔖' : '📑'}</span> Bookmark
                      </button>
                    </div>

                    {/* Tags Display */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="post-tags">
                        {post.tags.map(tag => (
                          <Link
                            key={tag._id}
                            to={`/tags/${tag.slug}`}
                            className="post-tag"
                          >
                            {tag.icon} {tag.label}
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Comments Section - Facebook Style */}
                    {postComments[post._id] && postComments[post._id].length > 0 && (
                      <div className="post-comments">
                        {postComments[post._id]
                          .filter(comment => comment.parentCommentId === null || comment.parentCommentId === undefined)
                          .slice(-3)
                          .map((comment) => (
                            <CommentThread
                              key={comment._id}
                              comment={comment}
                              replies={commentReplies[comment._id] || []}
                              currentUser={currentUser}
                              postId={post._id}
                              showReplies={showReplies}
                              editingCommentId={editingCommentId}
                              editCommentText={editCommentText}
                              showReactionPicker={showReactionPicker}
                              commentRefs={commentRefs}
                              getUserReactionEmoji={getUserReactionEmoji}
                              handleEditComment={handleEditComment}
                              handleSaveEditComment={handleSaveEditComment}
                              handleCancelEditComment={handleCancelEditComment}
                              handleDeleteComment={handleDeleteComment}
                              handleCommentReaction={handleCommentReaction}
                              toggleReplies={toggleReplies}
                              handleReplyToComment={handleReplyToComment}
                              setShowReactionPicker={setShowReactionPicker}
                              setReactionDetailsModal={setReactionDetailsModal}
                              setReportModal={setReportModal}
                            />
                          ))}
                      </div>


                    {/* Comment Input Box */}
                    {showCommentBox[post._id] && (
                      <form onSubmit={(e) => handleCommentSubmit(post._id, e)} className="comment-input-box">
                        <div className="comment-input-wrapper">
                          <div className="comment-user-avatar">
                            {currentUser?.profilePhoto ? (
                              <OptimizedImage
                                src={getImageUrl(currentUser.profilePhoto)}
                                alt="You"
                                className="avatar-image"
                              />
                            ) : (
                              <span>{currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={commentText[post._id] || ''}
                            onChange={(e) => handleCommentChange(post._id, e.target.value)}
                            placeholder={commentGif[post._id] ? "Add a caption (optional)..." : "Write a comment..."}
                            className="comment-input glossy"
                          />
                          <button
                            type="button"
                            className="btn-gif"
                            onClick={() => setShowGifPicker(showGifPicker === post._id ? null : post._id)}
                            title="Add GIF"
                          >
                            GIF
                          </button>
                          <button
                            type="submit"
                            className="comment-submit-btn"
                            disabled={!commentText[post._id]?.trim() && !commentGif[post._id]}
                          >
                            ➤
                          </button>
                        </div>
                        {commentGif[post._id] && (
                          <div className="comment-gif-preview">
                            <img src={commentGif[post._id]} alt="Selected GIF" />
                            <button
                              type="button"
                              className="btn-remove-gif"
                              onClick={() => setCommentGif(prev => ({ ...prev, [post._id]: null }))}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {showGifPicker === post._id && (
                          <GifPicker
                            onGifSelect={(gifUrl) => {
                              setCommentGif(prev => ({ ...prev, [post._id]: gifUrl }));
                              setShowGifPicker(null);
                            }}
                            onClose={() => setShowGifPicker(null)}
                          />
                        )}
                      </form>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`feed-sidebar ${showMobileSidebar ? 'mobile-visible' : ''}`}>
          {/* Featured Tags */}
          <div className="sidebar-card glossy">
            <h3 className="sidebar-title">Featured Tags</h3>
            <div className="trending-list">
              {trending.length > 0 ? (
                trending.map((item, index) => (
                  <Link
                    key={index}
                    to={`/hashtag/${item.hashtag.replace('#', '')}`}
                    className="trending-item"
                  >
                    {item.hashtag}
                    <span className="trending-count">{item.count} posts</span>
                  </Link>
                ))
              ) : (
                <div className="no-trending">
                  <p>No trending topics yet</p>
                  <p className="trending-hint">Start using hashtags in your posts!</p>
                </div>
              )}
            </div>
          </div>

          {/* Crisis Support */}
          <div className="sidebar-card glossy" style={{
            background: 'linear-gradient(135deg, var(--soft-lavender) 0%, rgba(108, 92, 231, 0.1) 100%)',
            border: '2px solid var(--pryde-purple)'
          }}>
            <h3 className="sidebar-title" style={{ color: 'var(--pryde-purple)' }}>💜 Need Support?</h3>
            <div style={{ padding: '0.5rem 0' }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
                If you're in crisis, help is available 24/7.
              </p>
              <Link
                to="/helplines"
                className="btn-primary"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  background: 'var(--pryde-purple)',
                  color: 'white',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--electric-blue)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--pryde-purple)'}
              >
                View Crisis Helplines
              </Link>
            </div>
          </div>

          {/* Friends List */}
          <div className="sidebar-card glossy">
            <h3 className="sidebar-title">Recent Conversations</h3>

            {/* Search Bar */}
            <div className="friends-search-bar">
              <input
                type="text"
                placeholder="Search friends..."
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                className="friends-search-input"
              />
            </div>

            <div className="friends-sidebar-list">
              {/* All Friends - Unified List */}
              {friends
                .filter(friend =>
                  (friend.displayName || friend.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
                )
                .map((friend) => {
                  const isOnline = onlineUsers.includes(friend._id);
                  logger.debug(`Friend ${friend.displayName} (${friend._id}):`, {
                    isOnline,
                    onlineUsers,
                    friendId: friend._id
                  });
                  const unreadCount = unreadMessageCounts[friend._id] || 0;
                  return (
                    <div key={friend._id} className="friend-sidebar-item">
                      <div className="friend-sidebar-main">
                        <div className="friend-sidebar-avatar">
                          {friend.profilePhoto ? (
                            <OptimizedImage
                              src={getImageUrl(friend.profilePhoto)}
                              alt={friend.displayName}
                              className="avatar-image"
                            />
                          ) : (
                            <span>{friend.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                          )}
                          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                        </div>
                        <div className="friend-sidebar-info">
                          <div className="friend-sidebar-name">{friend.displayName || friend.username}</div>
                          <div className={`friend-sidebar-status ${isOnline ? 'online-status' : 'offline-status'}`}>
                            {isOnline ? 'Online' : getTimeSince(friend.lastSeen)}
                          </div>
                        </div>
                        <div className="friend-sidebar-actions-top">
                          <Link
                            to={`/messages?chat=${friend._id}`}
                            className="btn-friend-action"
                            title="Chat"
                          >
                            💬
                            {unreadCount > 0 && (
                              <span className="friend-message-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                            )}
                          </Link>
                          <Link
                            to={`/profile/${friend._id}`}
                            className="btn-friend-action"
                            title="View Profile"
                          >
                            👤
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {friends.filter(f =>
                (f.displayName || f.username).toLowerCase().includes(friendSearchQuery.toLowerCase())
              ).length === 0 && friends.length > 0 && (
                <div className="no-friends">
                  <p>No matching friends</p>
                </div>
              )}

              {/* No Friends at All */}
              {friends.length === 0 && (
                <div className="no-friends">
                  <p>No friends yet</p>
                  <p className="friends-hint">Add friends to start chatting!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false, type: '', contentId: null, userId: null })}
        reportType={reportModal.type}
        contentId={reportModal.contentId}
        userId={reportModal.userId}
      />

      {photoViewerImage && (
        <PhotoViewer
          imageUrl={photoViewerImage}
          onClose={() => setPhotoViewerImage(null)}
        />
      )}

      {/* Privacy Settings Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="modal-content privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Custom Privacy Settings</h2>
              <button className="btn-close" onClick={() => setShowPrivacyModal(false)}>×</button>
            </div>

            <div className="privacy-modal-body">
              <div className="privacy-section">
                <h3>Hide from specific friends</h3>
                <p className="privacy-description">Select friends who won't see this post</p>
                <div className="friends-checklist">
                  {friends.map(friend => (
                    <label key={friend._id} className="friend-checkbox-item">
                      <input
                        type="checkbox"
                        checked={hiddenFromUsers.includes(friend._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setHiddenFromUsers([...hiddenFromUsers, friend._id]);
                            setSharedWithUsers(sharedWithUsers.filter(id => id !== friend._id));
                          } else {
                            setHiddenFromUsers(hiddenFromUsers.filter(id => id !== friend._id));
                          }
                        }}
                      />
                      <div className="friend-info">
                        <div className="friend-avatar-small">
                          {friend.profilePhoto ? (
                            <OptimizedImage
                              src={getImageUrl(friend.profilePhoto)}
                              alt={friend.displayName}
                              className="avatar-image"
                            />
                          ) : (
                            <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span>{friend.displayName || friend.username}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="privacy-divider">OR</div>

              <div className="privacy-section">
                <h3>Share with specific friends only</h3>
                <p className="privacy-description">Only selected friends will see this post</p>
                <div className="friends-checklist">
                  {friends.map(friend => (
                    <label key={friend._id} className="friend-checkbox-item">
                      <input
                        type="checkbox"
                        checked={sharedWithUsers.includes(friend._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSharedWithUsers([...sharedWithUsers, friend._id]);
                            setHiddenFromUsers(hiddenFromUsers.filter(id => id !== friend._id));
                          } else {
                            setSharedWithUsers(sharedWithUsers.filter(id => id !== friend._id));
                          }
                        }}
                      />
                      <div className="friend-info">
                        <div className="friend-avatar-small">
                          {friend.profilePhoto ? (
                            <OptimizedImage
                              src={getImageUrl(friend.profilePhoto)}
                              alt={friend.displayName}
                              className="avatar-image"
                            />
                          ) : (
                            <span>{friend.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span>{friend.displayName || friend.username}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => {
                setHiddenFromUsers([]);
                setSharedWithUsers([]);
                setShowPrivacyModal(false);
              }}>
                Clear All
              </button>
              <button className="btn-primary glossy-gold" onClick={() => setShowPrivacyModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <CustomModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        placeholder={modalState.placeholder}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        onConfirm={modalState.onConfirm}
        inputType={modalState.inputType}
        defaultValue={modalState.defaultValue}
      />

      <ShareModal
        isOpen={shareModal.isOpen}
        onClose={() => setShareModal({ isOpen: false, post: null })}
        post={shareModal.post}
        onShare={handleShareComplete}
      />

      {reactionDetailsModal.isOpen && (
        <ReactionDetailsModal
          reactions={reactionDetailsModal.reactions}
          likes={reactionDetailsModal.likes}
          onClose={() => setReactionDetailsModal({ isOpen: false, reactions: [], likes: [] })}
        />
      )}

      <EditHistoryModal
        isOpen={showEditHistory}
        onClose={() => {
          setShowEditHistory(false);
          setEditHistoryPostId(null);
        }}
        postId={editHistoryPostId}
        contentType="post"
      />
    </div>
  );
}

export default Feed;
