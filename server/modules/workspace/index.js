const express = require('express');
const router = express.Router(); // Explicitly creating router
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

// Correctly mount routes
const channelRoutes = require('./routes/channelRoutes');
const messageRoutes = require('./routes/messageRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

router.use('/channels', channelRoutes);
// Safe Import for Threads
try {
    const threadRoutes = require('./threads/threadRoutes');
    router.use('/threads', threadRoutes);
} catch (error) {
    console.error("Failed to load thread routes:", error.message);
}

router.use('/upload', uploadRoutes);

const registerWorkspaceSocket = require('./sockets/workspaceSocket');

module.exports = {
  router, // Exporting the router instance directly as a property
  registerWorkspaceSocket
};
