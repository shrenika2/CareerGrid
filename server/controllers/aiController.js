const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const InterviewAttempt = require('../models/InterviewAttempt');
const aiService = require('../services/aiService');
const axios = require('axios');

// Hardcoded knowledge base for mock questions
const questionBank = {
    'Frontend Developer': {
        technical: [
            "Explain the concept of React hooks and how they differ from class lifecycle methods.",
            "Describe the Critical Rendering Path and how you would optimize a web page for performance.",
            "What is the Virtual DOM and how does React's reconciliation algorithm work?",
            "How do you handle state management in large-scale React applications?",
            "Explain the difference between SSR (Server-Side Rendering) and CSR (Client-Side Rendering)."
        ],
        behavioral: [
            "Tell me about a time you had to learn a new technology quickly to meet a project deadline.",
            "Describe a situation where you disagreed with a designer's UI/UX choice. How did you resolve it?",
            "Tell me about a time you successfully optimized a slow web application."
        ]
    },
    'Backend Developer': {
        technical: [
            "Explain the differences between REST and GraphQL APIs. When would you use each?",
            "How do you design a scalable microservices architecture?",
            "Describe the ACID properties in database transactions and why they are important.",
            "What strategies would you use to secure an API against common vulnerabilities (OWASP top 10)?",
            "Explain indexing in databases and the trade-offs of using it heavily."
        ],
        behavioral: [
            "Tell me about a time when a critical system failed in production. How did you handle the outage?",
            "Describe a project where you had to collaborate closely with frontend teams to define API contracts.",
            "How do you handle prioritizing technical debt vs. shipping new features?"
        ]
    },
    'Data Scientist': {
        technical: [
            "Explain the bias-variance tradeoff in machine learning models.",
            "How do you deal with highly imbalanced datasets when training a classification model?",
            "Describe the difference between bagging and boosting ensemble methods.",
            "What evaluation metrics would you choose for a model predicting rare fraudulent transactions?",
            "Explain the concept of Principal Component Analysis (PCA) and its applications."
        ],
        behavioral: [
            "Tell me about a time you had to explain a complex ML model to a non-technical stakeholder.",
            "Describe a situation where your model performed well offline but failed in production.",
            "How do you handle incomplete or very messy datasets?"
        ]
    },
    'Default': {
        technical: [
            "Walk me through your problem-solving process when debugging an unfamiliar codebase.",
            "Explain a complex technical concept you recently learned as simply as possible.",
            "How do you ensure your code is readable, maintainable, and well-tested?",
            "Describe a challenging technical problem you solved recently.",
            "What is your approach to learning new programming languages or frameworks?"
        ],
        behavioral: [
            "Tell me about a time you made a mistake that affected your team, and how you recovered.",
            "Describe a situation where you had to work under a tight deadline.",
            "How do you handle receiving critical feedback on your work?"
        ]
    }
};

/**
 * @desc    Generate mock interview questions based on role and experience
 * @route   POST /api/ai/generate-questions
 * @access  Private (Student)
 */
const getMockQuestions = asyncHandler(async (req, res) => {
    const { jobRole = '', experience = '0' } = req.body;

    // Determine the category
    let categoryKey = 'Default';
    const roleLower = jobRole.toLowerCase();

    if (roleLower.includes('frontend') || roleLower.includes('ui') || roleLower.includes('web developer')) {
        categoryKey = 'Frontend Developer';
    } else if (roleLower.includes('backend') || roleLower.includes('api') || roleLower.includes('server')) {
        categoryKey = 'Backend Developer';
    } else if (roleLower.includes('data') || roleLower.includes('ml') || roleLower.includes('machine learning')) {
        categoryKey = 'Data Scientist';
    }

    const { technical, behavioral } = questionBank[categoryKey];

    // Helper to shuffle array
    const shuffleArray = (array) => [...array].sort(() => 0.5 - Math.random());

    // Pick 3 technical and 2 behavioral
    const selectedTechnical = shuffleArray(technical).slice(0, 3);
    const selectedBehavioral = shuffleArray(behavioral).slice(0, 2);

    // Combine and shuffle the final set
    const finalSet = shuffleArray([...selectedTechnical, ...selectedBehavioral]);

    res.status(200).json({
        success: true,
        roleMatched: categoryKey,
        experienceAssumed: experience,
        questions: finalSet
    });
});

/**
 * @desc    Configure local AI session with student resume and opportunity details
 * @route   POST /api/ai/setup-local-session
 * @access  Private (Student)
 */
const setupLocalSession = asyncHandler(async (req, res) => {
    const { opportunityId } = req.body;
    const userId = req.user._id;

    // 1. Fetch user to get resumeUrl
    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    const resumeUrl = user.studentProfile?.resumeUrl || user.studentProfile?.resumeFileUrl;
    
    // 2. Fetch opportunity details if provided
    let jobDescription = "General Placement Interview";
    if (opportunityId) {
        const opportunity = await Opportunity.findById(opportunityId).populate('postedBy');
        if (opportunity) {
            jobDescription = `Role: ${opportunity.title}\nCompany: ${opportunity.postedBy?.name || 'Target Company'}\nDescription: ${opportunity.description}\nRequired Skills: ${(opportunity.requiredSkills || []).join(', ')}`;
        }
    }

    // 3. Extract resume text from URL or fall back to profile skills
    let resumeText = "";
    if (resumeUrl) {
        try {
            const extraction = await aiService.extractTextFromURL(resumeUrl);
            if (extraction.success) {
                resumeText = extraction.text;
            }
        } catch (err) {
            console.error('[AI_CONTROLLER] Error extracting text from URL:', err.message);
        }
    }

    // Fallback if resume text extraction is empty
    if (!resumeText || !resumeText.trim()) {
        const parsedSkills = user.studentProfile?.parsedSkills || [];
        resumeText = `Candidate Name: ${user.name}\nSkills: ${parsedSkills.join(', ')}\nEmail: ${user.email}`;
    }

    // 4. Post to FastAPI server to setup the interview session
    try {
        const fastapiUrl = process.env.AI_API_URL || process.env.VITE_AI_API_URL || 'http://localhost:8000';
        const response = await axios.post(`${fastapiUrl}/api/setup-interview-text`, {
            resume_text: resumeText,
            job_description: jobDescription
        }, { timeout: 10000 });

        if (response.data && response.data.session_id) {
            return res.status(200).json({
                success: true,
                session_id: response.data.session_id
            });
        } else {
            res.status(500);
            throw new Error('Failed to configure local AI session');
        }
    } catch (error) {
        console.error('[AI_CONTROLLER] FastAPI setup error:', error.message);
        res.status(500);
        throw new Error(`AI Backend service unavailable: ${error.message}`);
    }
});

const runWithTimeout = async (promise, timeoutMs = 3000) => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database operation timeout')), timeoutMs);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timer);
        return result;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
};

/**
 * @desc    Submit a completed mock interview attempt
 * @route   POST /api/ai/interview-attempts
 * @access  Private (Student)
 */
const submitInterviewAttempt = asyncHandler(async (req, res) => {
    const { jobTitle, responses } = req.body;
    const studentId = req.user._id;

    if (!jobTitle || !responses || !Array.isArray(responses)) {
        res.status(400);
        throw new Error('Please provide jobTitle and responses array');
    }

    // Programmatic score calculation based on response lengths and keyword weights
    let wordCountScore = 0;
    let keywordScore = 0;
    const keywords = ['react', 'node', 'javascript', 'api', 'database', 'design', 'architecture', 'optimize', 'performance', 'security', 'state', 'hooks', 'scale', 'scaling', 'index', 'query', 'cache'];
    
    responses.forEach(r => {
        const text = (r.answer || '').toLowerCase();
        const words = text.split(/\s+/).filter(Boolean).length;
        wordCountScore += Math.min(10, Math.floor(words / 10)); // max 10 points per answer based on word count
        
        keywords.forEach(kw => {
            if (text.includes(kw)) {
                keywordScore += 2;
            }
        });
    });

    const numResponses = responses.length || 1;
    const technical = Math.min(100, Math.max(50, Math.round((keywordScore / numResponses) * 15 + 40)));
    const communication = Math.min(100, Math.max(50, Math.round((wordCountScore / numResponses) * 8 + 30)));
    const finalCalculatedScore = Math.round((technical + communication) / 2);

    let attempt;
    try {
        // Enforce 3-second database timeout
        attempt = await runWithTimeout(
            InterviewAttempt.create({
                student: studentId,
                jobTitle,
                responses,
                score: finalCalculatedScore,
                breakdown: { technical, communication }
            }),
            3000
        );

        // Update user profile readinessHistory
        await runWithTimeout(
            User.findByIdAndUpdate(studentId, {
                $push: {
                    "studentProfile.readinessHistory": {
                        score: finalCalculatedScore,
                        date: new Date()
                    }
                }
            }),
            3000
        );

        // Broadcast Socket metrics_update event
        const io = req.app.get('io') || req.app.get('socketio');
        if (io) {
            console.log(`[AI_CONTROLLER] Emitting metrics_update for user_${studentId}`);
            io.to(`user_${studentId}`).emit('metrics_update', {
                type: 'INTERVIEW_COMPLETE',
                newScore: finalCalculatedScore,
                attemptId: attempt._id
            });
        }

        return res.status(201).json({
            success: true,
            attempt
        });

    } catch (err) {
        console.error('[AI_CONTROLLER] Submit attempt failed or timed out:', err.message);
        
        // Return structured mock/demo dataset to prevent crashing
        const mockAttempt = {
            _id: new mongoose.Types.ObjectId(),
            student: studentId,
            jobTitle,
            responses,
            score: finalCalculatedScore,
            breakdown: { technical, communication },
            completedAt: new Date()
        };

        return res.status(201).json({
            success: true,
            isMock: true,
            attempt: mockAttempt
        });
    }
});

/**
 * @desc    Get interview attempt details by ID
 * @route   GET /api/ai/interview-attempts/:id
 * @access  Private (Student)
 */
const getInterviewAttemptDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const attempt = await runWithTimeout(
            InterviewAttempt.findById(id),
            3000
        );

        if (!attempt) {
            res.status(404);
            throw new Error('Interview attempt not found');
        }

        return res.status(200).json({
            success: true,
            attempt
        });
    } catch (err) {
        console.error('[AI_CONTROLLER] Fetch attempt details failed or timed out:', err.message);
        
        // Return a structured mock/demo dataset to prevent crashing
        const mockAttempt = {
            _id: id,
            student: req.user?._id || new mongoose.Types.ObjectId(),
            jobTitle: "Software Engineer",
            responses: [
                { question: "Explain React lifecycle methods.", answer: "React lifecycle methods are...", feedback: "Good answer." }
            ],
            score: 75,
            breakdown: { technical: 70, communication: 80 },
            completedAt: new Date()
        };

        return res.status(200).json({
            success: true,
            isMock: true,
            attempt: mockAttempt
        });
    }
});

module.exports = {
    getMockQuestions,
    setupLocalSession,
    submitInterviewAttempt,
    getInterviewAttemptDetails
};
