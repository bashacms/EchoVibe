// src/components/pages/FeedPage.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { VibeEcho, User, Comment } from '../../types';
import PostCard from '../common/PostCard';
import CommentModal from '../common/CommentModal';
import { Smile, Send } from 'lucide-react';

interface FeedPageProps {
  user: User;
}

const FeedPage: React.FC<FeedPageProps> = ({ user }) => {
  const [posts, setPosts] = useState<(VibeEcho & { profile?: any; user_has_liked?: boolean })[]>([]);
  const [newPost, setNewPost] = useState('');
  const [selectedMood, setSelectedMood] = useState('happy');
  const [uploading, setUploading] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);

  const moods = ['happy', 'excited', 'peaceful', 'thoughtful', 'grateful', 'creative'];

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        return;
      }

      if (profile) {
        setUserProfile(profile);
      } else {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
            avatar_url: user.user_metadata?.avatar_url,
            is_online: true,
            last_active: new Date().toISOString()
          }])
          .select()
          .single();

        if (!insertError && newProfile) setUserProfile(newProfile);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  }, [user]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);

    try {
      const { data: postsData, error } = await supabase
        .from('vibe_echoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      if (postsData && mountedRef.current) {
        const postsWithProfiles = await Promise.all(postsData.map(async post => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', post.user_id)
              .single();

            const { data: likes } = await supabase
              .from('likes')
              .select('user_id')
              .eq('post_id', post.id);

            return {
              ...post,
              profile: profile || null,
              user_has_liked: likes?.some(like => like.user_id === user.id) || false
            };
          } catch (innerErr) {
            console.error('Error fetching profile/likes for post', post.id, innerErr);
            return { ...post, profile: null, user_has_liked: false };
          }
        }));

        setPosts(postsWithProfiles);
      }
    } catch (err) {
      console.error('Unexpected error fetching posts:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchUserProfile();
    fetchPosts();
    return () => { mountedRef.current = false; };
  }, [fetchUserProfile, fetchPosts]);

  const handleTextareaResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewPost(e.target.value);
    handleTextareaResize();
  };

  const handlePost = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newPost.trim() || uploading) return;

    setUploading(true);
    try {
      const { error } = await supabase.from('vibe_echoes').insert([{
        content: newPost.trim(),
        user_id: user.id,
        mood: selectedMood,
        profile_id: userProfile?.id,
        created_at: new Date().toISOString()
      }]);
      if (error) throw error;

      setNewPost('');
      setSelectedMood('happy');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post. Please try again.');
    } finally { setUploading(false); }
  };

  const handleLike = async (postId: string) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.user_has_liked) {
        await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }]);
      }

      fetchPosts();
    } catch (error) { console.error('Error handling like:', error); }
  };

  const handleComment = (postId: string) => {
    setSelectedPostId(postId);
    setShowCommentModal(true);
    fetchComments(postId);
  };

  const handleShare = (postId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
    alert('Post link copied to clipboard!');
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const { error } = await supabase.from('vibe_echoes').delete().eq('id', postId).eq('user_id', user.id);
      if (error) throw error;
      fetchPosts();
    } catch (error) { console.error('Error deleting post:', error); }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
      if (error) throw error;
      setComments(data || []);
    } catch (error) { console.error('Error fetching comments:', error); }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedPostId) return;
    try {
      const { error } = await supabase.from('comments').insert([{ content: newComment.trim(), post_id: selectedPostId, user_id: user.id }]);
      if (error) throw error;
      setNewComment('');
      fetchComments(selectedPostId);
    } catch (error) { console.error('Error submitting comment:', error); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div>;

  return (
    <motion.main initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Post Creation Form */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <form onSubmit={handlePost} className="space-y-4">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {userProfile?.avatar_url ? <img src={userProfile.avatar_url} alt="avatar" className="w-full h-full rounded-full object-cover"/> : userProfile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 space-y-4">
              <textarea
                ref={textareaRef}
                value={newPost}
                onChange={handleTextChange}
                placeholder="how are you feeling now"
                className="w-full bg-transparent text-white placeholder-white/60 resize-none focus:outline-none text-lg min-h-[80px] max-h-[200px] rounded-md p-2 border border-white/20"
                maxLength={280}
                rows={1}
              />
              {/* Mood Selector */}
              <div className="space-y-2">
                <p className="text-sm text-white/70">Current mood:</p>
                <div className="flex gap-2 flex-wrap">
                  {moods.map(mood => (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => setSelectedMood(mood)}
                      className={`px-3 py-2 rounded-full text-sm transition-all cursor-pointer ${
                        selectedMood === mood ? 'bg-purple-500 text-white shadow-lg' : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      <Smile size={14} className="inline mr-1"/>
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
              {/* Post Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newPost.trim() || uploading}
                  className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Send size={16}/>} Post
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length > 0 ? posts.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onComment={handleComment}
            onShare={handleShare}
            onDelete={post.user_id === user.id ? handleDeletePost : undefined}
            currentUser={user}
          />
        )) : <div className="text-center py-12"><p className="text-white/60 text-lg">No posts yet. Share something!</p></div>}
      </div>

      {/* Comment Modal */}
      <CommentModal
        isOpen={showCommentModal}
        onClose={() => setShowCommentModal(false)}
        postId={selectedPostId}
        comments={comments}
        newComment={newComment}
        setNewComment={setNewComment}
        onSubmitComment={handleSubmitComment}
        currentUser={user}
      />
    </motion.main>
  );
};

export default FeedPage;
