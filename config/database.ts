import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

export const dbConfig = {
  mongoUrl: process.env.MONGO_URL,
};

export const connectDatabase = async (): Promise<void> => {
  try {
    if (!dbConfig.mongoUrl) {
      throw new Error('MONGO_URL environment variable is not defined');
    }
    await mongoose.connect(dbConfig.mongoUrl);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
};

