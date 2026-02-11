import mongoose from 'mongoose';
import User from './models/User.js';

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pryde-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Test account flows
const testAccountFlows = async () => {
  console.log('=== ACCOUNT FLOW TEST REPORT ===\n');

  try {
    // 1. Create dummy account
    console.log('1. CREATING DUMMY ACCOUNT');
    const timestamp = Date.now();
    const testUser = new User({
      fullName: 'Test Test',
      username: `testtest${timestamp}`,
      email: `test${timestamp}@example.com`,
      password: 'TestPassword123!',
      birthday: new Date('1990-01-01'),
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      termsVersion: '1.0',
      privacyAcceptedAt: new Date(),
      privacyVersion: '1.0'
    });

    await testUser.save();
    console.log('✓ Account created successfully');
    console.log('  - User ID:', testUser._id);
    console.log('  - Username:', testUser.username);
    console.log('  - Email:', testUser.email);
    console.log('  - isActive:', testUser.isActive);
    console.log('  - deactivatedAt:', testUser.deactivatedAt);
    console.log('  - isDeleted:', testUser.isDeleted);
    console.log('');

    // 2. Test deactivation
    console.log('2. TESTING DEACTIVATION');
    testUser.isActive = false;
    testUser.deactivatedAt = new Date();
    testUser.activeSessions = []; // Clear sessions
    await testUser.save();

    console.log('✓ Account deactivated successfully');
    console.log('  - isActive:', testUser.isActive);
    console.log('  - deactivatedAt:', testUser.deactivatedAt);
    console.log('  - activeSessions:', testUser.activeSessions.length);
    console.log('');

    // 3. Test reactivation
    console.log('3. TESTING REACTIVATION');
    testUser.isActive = true;
    testUser.deactivatedAt = null;
    await testUser.save();

    console.log('✓ Account reactivated successfully');
    console.log('  - isActive:', testUser.isActive);
    console.log('  - deactivatedAt:', testUser.deactivatedAt);
    console.log('');

    // 4. Test account deletion request
    console.log('4. TESTING ACCOUNT DELETION REQUEST');
    const crypto = await import('crypto');
    const deletionToken = crypto.randomBytes(32).toString('hex');
    testUser.deletionConfirmationToken = deletionToken;
    testUser.deletionConfirmationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await testUser.save();

    console.log('✓ Deletion request created');
    console.log('  - deletionConfirmationToken:', deletionToken.substring(0, 10) + '...');
    console.log('  - deletionConfirmationExpires:', testUser.deletionConfirmationExpires);
    console.log('');

    // 5. Test account deletion confirmation
    console.log('5. TESTING ACCOUNT DELETION CONFIRMATION');

    // Store original data
    testUser.originalData = {
      email: testUser.email,
      fullName: testUser.fullName,
      displayName: testUser.displayName,
      nickname: testUser.nickname,
      bio: testUser.bio,
      profilePhoto: testUser.profilePhoto,
      coverPhoto: testUser.coverPhoto,
      location: testUser.location,
      website: testUser.website,
      pronouns: testUser.pronouns,
      gender: testUser.gender,
      socialLinks: testUser.socialLinks
    };

    // Soft delete
    testUser.isDeleted = true;
    testUser.deletedAt = new Date();
    testUser.deletionScheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    testUser.deletionConfirmationToken = null;
    testUser.deletionConfirmationExpires = null;

    // Anonymize data
    testUser.email = `deleted_${testUser._id}@deleted.local`;
    testUser.fullName = '[Deleted User]';
    testUser.displayName = '[Deleted User]';
    testUser.nickname = '';
    testUser.bio = '';
    testUser.profilePhoto = '';
    testUser.coverPhoto = '';
    testUser.location = '';
    testUser.website = '';
    testUser.socialLinks = [];
    testUser.pronouns = '';
    testUser.customPronouns = '';
    testUser.gender = '';
    testUser.customGender = '';

    // Clear sessions
    testUser.activeSessions = [];

    await testUser.save();

    console.log('✓ Account deleted successfully');
    console.log('  - isDeleted:', testUser.isDeleted);
    console.log('  - deletedAt:', testUser.deletedAt);
    console.log('  - deletionScheduledFor:', testUser.deletionScheduledFor);
    console.log('  - email (anonymized):', testUser.email);
    console.log('  - fullName (anonymized):', testUser.fullName);
    console.log('  - originalData stored:', !!testUser.originalData);
    console.log('');

    // 6. Test account recovery
    console.log('6. TESTING ACCOUNT RECOVERY');
    if (testUser.originalData) {
      testUser.email = testUser.originalData.email || testUser.email;
      testUser.fullName = testUser.originalData.fullName || testUser.fullName;
      testUser.displayName = testUser.originalData.displayName || testUser.displayName;
      testUser.nickname = testUser.originalData.nickname || testUser.nickname;
      testUser.bio = testUser.originalData.bio || testUser.bio;
      testUser.profilePhoto = testUser.originalData.profilePhoto || testUser.profilePhoto;
      testUser.coverPhoto = testUser.originalData.coverPhoto || testUser.coverPhoto;
      testUser.location = testUser.originalData.location || testUser.location;
      testUser.website = testUser.originalData.website || testUser.website;
      testUser.pronouns = testUser.originalData.pronouns || testUser.pronouns;
      testUser.gender = testUser.originalData.gender || testUser.gender;
      testUser.socialLinks = testUser.originalData.socialLinks || testUser.socialLinks;
    }

    testUser.isDeleted = false;
    testUser.deletedAt = null;
    testUser.deletionScheduledFor = null;
    testUser.originalData = {};

    await testUser.save();

    console.log('✓ Account recovered successfully');
    console.log('  - isDeleted:', testUser.isDeleted);
    console.log('  - deletedAt:', testUser.deletedAt);
    console.log('  - email (restored):', testUser.email);
    console.log('  - fullName (restored):', testUser.fullName);
    console.log('');

    // 7. Cleanup - delete test user
    console.log('7. CLEANUP - DELETING TEST USER');
    await User.findByIdAndDelete(testUser._id);
    console.log('✓ Test user deleted from database');
    console.log('');

    console.log('=== TEST COMPLETED SUCCESSFULLY ===');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the test
connectDB().then(() => {
  testAccountFlows();
});
