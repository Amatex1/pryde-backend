import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';

dotenv.config();

const checkComments = async () => {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/pryde-social';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Check Comment collection
    const commentCount = await Comment.countDocuments();
    console.log(`📊 Comments in Comment collection: ${commentCount}`);

    // Check posts with embedded comments
    const postsWithComments = await Post.find({ 'comments.0': { $exists: true } });
    console.log(`📊 Posts with embedded comments: ${postsWithComments.length}`);

    if (postsWithComments.length > 0) {
      let totalEmbeddedComments = 0;
      postsWithComments.forEach(post => {
        totalEmbeddedComments += post.comments.length;
        console.log(`   Post ${post._id}: ${post.comments.length} embedded comments`);
      });
      console.log(`📊 Total embedded comments: ${totalEmbeddedComments}\n`);

      console.log('⚠️  You have embedded comments that need to be migrated!');
      console.log('💡 Run: node server/scripts/migrateComments.js');
    } else {
      console.log('✅ No embedded comments found. All comments are in the Comment collection.');
    }

    // Show sample comments from Comment collection
    if (commentCount > 0) {
      console.log('\n📝 Sample comments from Comment collection:');
      const sampleComments = await Comment.find()
        .populate('authorId', 'username')
        .limit(5)
        .lean();
      
      sampleComments.forEach(comment => {
        console.log(`   - ${comment.authorId?.username}: "${comment.content?.substring(0, 50)}..."`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkComments();

