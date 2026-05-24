const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
    console.error('[CRITICAL] JWT_SECRET is not defined in environment variables under production mode!');
    throw new Error('CRITICAL ERROR: JWT_SECRET environment variable is required in production mode to secure user authentication tokens.');
}

const env = {
    NODE_ENV: nodeEnv,
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/internship_portal',
    JWT_SECRET: process.env.JWT_SECRET || 'your_super_secret_jwt_key_12345',
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000',
    SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:5000',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 mins
    RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,
};

// Log configuration status (avoiding sensitive data)
console.log(`[CONFIG] System environment initialized: ${env.NODE_ENV.toUpperCase()}`);

module.exports = env;
