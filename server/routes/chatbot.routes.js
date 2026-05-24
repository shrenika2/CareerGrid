const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

/**
 * @route   POST /api/chatbot/chat
 * @desc    Send a message and get a streaming response
 * @access  Private
 */
router.post('/chat', chatbotController.handleChat);

/**
 * @route   GET /api/chatbot/history
 * @desc    List all past chat sessions
 */
router.get('/history', chatbotController.getHistory);

/**
 * @route   GET /api/chatbot/history/:id
 * @desc    Get messages for a specific chat session
 */
router.get('/history/:id', chatbotController.getChatById);

/**
 * @route   DELETE /api/chatbot/history/:id
 * @desc    Delete a chat session
 */
router.delete('/history/:id', chatbotController.deleteChat);

module.exports = router;
