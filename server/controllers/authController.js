const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const settingsService = require('../utils/settingsService');
const { logAction } = require('../utils/auditService');
const { validateRegister, validateLogin } = require('../middleware/validationMiddleware');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    // 0. Joi Validation
    const { error } = validateRegister(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details.map(d => d.message).join(', '));
    }

    const { name, email, password, role, studentProfile, companyProfile, facultyProfile } = req.body;
    const settings = await settingsService.getSettings();

    // 1. Domain Validation
    if (role === 'student' && !email.endsWith('.edu')) {
        res.status(400);
        throw new Error('Please use your college (.edu) email address');
    }

    if (role === 'company' && settings.allowedCompanyEmailDomains.length > 0) {
        const domain = email.split('@')[1];
        if (!settings.allowedCompanyEmailDomains.includes(domain)) {
            res.status(400);
            throw new Error(`Registration restricted to specific company domains: ${settings.allowedCompanyEmailDomains.join(', ')}`);
        }
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // 2. Role Security
    if (role === 'admin') {
        res.status(403);
        throw new Error('Admin registration is not allowed');
    }
    const finalRole = role || 'student';

    // 3. Status & Auto-approval Logic
    let status = 'pending';
    let isVerified = false;

    if (finalRole === 'student' && settings.enableStudentAutoApproval) {
        status = 'approved';
        isVerified = true;
    } else if (finalRole === 'company' && settings.enableCompanyAutoApproval) {
        status = 'approved';
        isVerified = true;
    } else if (finalRole === 'faculty') {
        // Faculty usually always requires manual verification unless specified otherwise
        status = 'pending';
    }

    const userData = {
        name,
        email,
        password,
        role: finalRole,
        status,
        isVerified
    };

    // Profile sanitation: Remove empty strings and nulls to prevent CastErrors
    const sanitizeProfile = (profile) => {
        if (!profile) return undefined;
        const sanitized = {};
        Object.keys(profile).forEach(key => {
            if (profile[key] !== '' && profile[key] !== null && profile[key] !== undefined) {
                sanitized[key] = profile[key];
            }
        });
        return Object.keys(sanitized).length > 0 ? sanitized : undefined;
    };

    // Attach profile based on role
    if (finalRole === 'student') userData.studentProfile = sanitizeProfile(studentProfile);
    if (finalRole === 'company') userData.companyProfile = sanitizeProfile(companyProfile);
    if (finalRole === 'faculty') userData.facultyProfile = sanitizeProfile(facultyProfile);

    const user = await User.create(userData);

    if (user) {
        logAction({
            userId: user._id,
            action: 'USER_REGISTER',
            entityType: 'User',
            entityId: user._id,
            metadata: { role: user.role, status: user.status },
            req
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            isVerified: user.isVerified,
            isSuspended: user.isSuspended,
            token: generateToken(user._id, user.role),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Authenticate user
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    // 0. Joi Validation
    const { error } = validateLogin(req.body);
    if (error) {
        res.status(400);
        throw new Error(error.details.map(d => d.message).join(', '));
    }

    const { email, password } = req.body;
    console.log(`[AUTH] Login attempt received for: ${email}`);

    const settings = await settingsService.getSettings();
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        console.error(`[AUTH] Login failed: User not found for email ${email}`);
        res.status(401);
        throw new Error('Invalid email or password');
    }

    const isMatch = await user.matchPassword(password);
    console.log(`[AUTH] User found: ${user.email}, Role: ${user.role}`);

    if (!isMatch) {
        console.error(`[AUTH] Login failed: Incorrect password for ${email}`);
        res.status(401);
        throw new Error('Invalid email or password');
    }

    if (user.isSuspended || user.status === 'blocked' || user.status === 'rejected') {
        const reason = user.isSuspended ? 'Account suspended' : `Account status: ${user.status}`;
        console.error(`[AUTH] Login failed: ${reason} for ${email}`);
        res.status(403);
        throw new Error(`Access Denied: Your account has been ${user.isSuspended ? 'suspended' : user.status}.`);
    }

    logAction({
        userId: user._id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user._id,
        req
    });

    res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        isVerified: user.isVerified || user.status === 'approved',
        isSuspended: user.isSuspended,
        token: generateToken(user._id, user.role),
    });
});

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            isVerified: user.isVerified || user.status === 'approved',
            isSuspended: user.isSuspended,
            studentProfile: user.studentProfile,
            companyProfile: user.companyProfile,
            facultyProfile: user.facultyProfile,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Get account status
// @route   GET /api/auth/status
// @access  Private (Token Only)
const getStatus = asyncHandler(async (req, res) => {
    res.json({
        status: req.user.status,
        isVerified: req.user.isVerified || req.user.status === 'approved',
        isSuspended: req.user.isSuspended
    });
});

module.exports = {
    registerUser,
    loginUser,
    getMe,
    getStatus,
};
