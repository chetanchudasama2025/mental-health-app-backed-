/**
 * Initial database setup migration
 * Creates all necessary indexes for optimal query performance
 */

module.exports = {
  async up(db) {
    console.log('Running initial setup migration...');

    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ role: 1 });
    await usersCollection.createIndex({ deletedAt: 1 });
    await usersCollection.createIndex({ 'phone.countryCode': 1, 'phone.number': 1 });
    console.log('✓ User indexes created');

    const therapistsCollection = db.collection('therapists');
    await therapistsCollection.createIndex({ user: 1 }, { unique: true });
    await therapistsCollection.createIndex({ email: 1 }, { unique: true });
    await therapistsCollection.createIndex({ isVerified: 1 });
    await therapistsCollection.createIndex({ deletedAt: 1 });
    await therapistsCollection.createIndex({ specializations: 1 });
    console.log('✓ Therapist indexes created');

    const bookingsCollection = db.collection('bookings');
    await bookingsCollection.createIndex({ patient: 1, date: 1 });
    await bookingsCollection.createIndex({ therapist: 1, date: 1, time: 1 }, {
      unique: true,
      partialFilterExpression: {
        status: { $in: ['pending', 'confirmed'] }
      }
    });
    await bookingsCollection.createIndex({ status: 1 });
    await bookingsCollection.createIndex({ therapist: 1, date: 1 });
    await bookingsCollection.createIndex({ patient: 1 });
    console.log('✓ Booking indexes created');

    const paymentsCollection = db.collection('payments');
    await paymentsCollection.createIndex({ user: 1 });
    await paymentsCollection.createIndex({ paymentIntentId: 1 }, { unique: true });
    await paymentsCollection.createIndex({ status: 1 });
    await paymentsCollection.createIndex({ deletedAt: 1 });
    await paymentsCollection.createIndex({ createdAt: -1 });
    console.log('✓ Payment indexes created');

    const conversationsCollection = db.collection('conversations');
    await conversationsCollection.createIndex({ participants: 1 });
    await conversationsCollection.createIndex({ lastMessageAt: -1 });
    await conversationsCollection.createIndex({ deletedAt: 1 });
    console.log('✓ Conversation indexes created');

    const messagesCollection = db.collection('messages');
    await messagesCollection.createIndex({ conversation: 1, createdAt: -1 });
    await messagesCollection.createIndex({ sender: 1 });
    await messagesCollection.createIndex({ deletedAt: 1 });
    console.log('✓ Message indexes created');

    const notificationsCollection = db.collection('notifications');
    await notificationsCollection.createIndex({ user: 1, isRead: 1, createdAt: -1 });
    await notificationsCollection.createIndex({ user: 1 });
    await notificationsCollection.createIndex({ isRead: 1 });
    console.log('✓ Notification indexes created');

    const supportTicketsCollection = db.collection('supporttickets');
    await supportTicketsCollection.createIndex({ userId: 1 });
    await supportTicketsCollection.createIndex({ status: 1 });
    await supportTicketsCollection.createIndex({ priority: 1 });
    await supportTicketsCollection.createIndex({ issueCategory: 1 });
    await supportTicketsCollection.createIndex({ deletedAt: 1 });
    await supportTicketsCollection.createIndex({ createdAt: -1 });
    console.log('✓ SupportTicket indexes created');

    const availabilitiesCollection = db.collection('availabilities');
    await availabilitiesCollection.createIndex({ therapistId: 1 }, { unique: true });
    await availabilitiesCollection.createIndex({ serviceEnabled: 1 });
    console.log('✓ Availability indexes created');

    const emailVerificationTokensCollection = db.collection('emailverificationtokens');
    await emailVerificationTokensCollection.createIndex({ token: 1 }, { unique: true });
    await emailVerificationTokensCollection.createIndex({ email: 1 });
    await emailVerificationTokensCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log('✓ EmailVerificationToken indexes created');

    const passwordResetTokensCollection = db.collection('passwordresettokens');
    await passwordResetTokensCollection.createIndex({ token: 1 }, { unique: true });
    await passwordResetTokensCollection.createIndex({ email: 1 });
    await passwordResetTokensCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log('✓ PasswordResetToken indexes created');

    console.log('✅ Initial setup migration completed successfully!');
  },

  async down(db) {
    console.log('Rolling back initial setup migration...');

    const collections = [
      'users', 'therapists', 'bookings', 'payments', 'conversations',
      'messages', 'notifications', 'supporttickets', 'availabilities',
      'emailverificationtokens', 'passwordresettokens'
    ];

    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const indexes = await collection.indexes();

      for (const index of indexes) {
        if (index.name !== '_id_') {
          try {
            await collection.dropIndex(index.name);
            console.log(`✓ Dropped index ${index.name} from ${collectionName}`);
          } catch (error) {
            console.log(`⚠ Could not drop index ${index.name} from ${collectionName}: ${error.message}`);
          }
        }
      }
    }

    console.log('✅ Rollback completed!');
  }
};

