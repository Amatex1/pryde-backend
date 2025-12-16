import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';

dotenv.config();

const testCommentCreation = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/pryde-social';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Find a post to comment on
    const post = await Post.findOne().limit(1);
    if (!post) {
      console.log('❌ No posts found. Create a post first.');
      await mongoose.connection.close();
      return;
    }

    console.log(`📝 Found post: ${post._id}`);
    console.log(`   Content: "${post.content?.substring(0, 50)}..."`);

    // Find a user to create comment as
    const user = await User.findOne().limit(1);
    if (!user) {
      console.log('❌ No users found.');
      await mongoose.connection.close();
      return;
    }

    console.log(`👤 Found user: ${user.username} (${user._id})\n`);

    // Create a test comment
    console.log('💬 Creating test comment...');
    const comment = new Comment({
      postId: post._id,
      authorId: user._id,
      content: 'This is a test comment created by the migration script',
      parentCommentId: null
    });

    await comment.save();
    await comment.populate('authorId', 'username displayName profilePhoto isVerified pronouns');

    console.log('✅ Comment created successfully!');
    console.log(`   Comment ID: ${comment._id}`);
    console.log(`   Content: "${comment.content}"`);
    console.log(`   Author: ${comment.authorId.username}\n`);

    // Verify it can be fetched
    const fetchedComments = await Comment.find({ postId: post._id })
      .populate('authorId', 'username displayName profilePhoto isVerified pronouns')
      .lean();

    console.log(`📊 Total comments for this post: ${fetchedComments.length}`);
    fetchedComments.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.authorId?.username}: "${c.content?.substring(0, 50)}..."`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Done! Try refreshing your feed to see the comment.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testCommentCreation();

