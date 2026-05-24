const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getMockQuestions, setupLocalSession, submitInterviewAttempt, getInterviewAttemptDetails } = require('../controllers/aiController');

// All AI Mock Interview routes require authentication
router.use(protect);

router.post('/generate-questions', getMockQuestions);
router.post('/setup-local-session', setupLocalSession);
router.post('/interview-attempts', submitInterviewAttempt);
router.get('/interview-attempts/:id', getInterviewAttemptDetails);

module.exports = router;
