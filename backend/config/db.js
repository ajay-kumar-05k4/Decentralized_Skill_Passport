const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digital-skill-passport';

  try {
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error(
      'The API cannot serve data without a database. Check that MONGO_URI in .env points ' +
        'to a running MongoDB instance (local mongod or a MongoDB Atlas cluster).'
    );
    // Fail fast instead of booting a server whose every route will time out.
    if (process.env.NODE_ENV !== 'test') process.exit(1);
    throw error;
  }
};

module.exports = connectDB;
