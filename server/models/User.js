const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'],
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please add a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            minlength: 6,
            select: false,
        },
        role: {
            type: String,
            enum: ['student', 'company', 'faculty', 'admin'],
            default: 'student', // DEV ONLY: Allow 'admin' to be created via registration
        },
        // Common fields
        phone: String,
        location: String,
        bio: String,
        avatar: String,
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'blocked'],
            default: 'pending'
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        isSuspended: {
            type: Boolean,
            default: false
        },

        // Student specific (Unified Profile)
        studentProfile: {
            collegeId: String,
            college: String,
            branch: {
                type: String,
                default: ""
            },
            year: Number,
            cgpa: Number,
            skills: [String],
            techStack: [String],
            resumeUrl: String,
            resumeFileUrl: String, // Persistent link to Cloudinary/Secure file
            parsedSkills: [String], // PERSISTENCE: Reused for all future applications
            resumeParsedAt: Date, // Timestamp for optimization
            links: {
                github: String,
                linkedin: String,
                portfolio: String,
            },
            portfolio: String, // Keeping this for backward compatibility if needed, but using links.portfolio primarily
            cpProfiles: {
                leetcode: String,
                codeforces: String,
                codechef: String,
            },
            experiences: [
                {
                    title: String,
                    company: String,
                    description: String,
                    startDate: Date,
                    endDate: Date,
                    isCurrent: Boolean,
                },
            ],
            isComplete: {
                type: Boolean,
                default: false,
            },
            readinessHistory: [
                {
                    score: Number,
                    date: {
                        type: Date,
                        default: Date.now
                    }
                }
            ]
        },

        // Company specific
        companyProfile: {
            companyName: String,
            website: String,
            industry: String,
            location: String,
            description: String,
        },

        // Faculty specific
        facultyProfile: {
            department: String,
            designation: String,
        },
    },
    {
        timestamps: true,
    }
);

// Add virtual field to schema for admin creation secret verification
userSchema.virtual('adminSecret')
    .get(function() { return this._adminSecret; })
    .set(function(value) { this._adminSecret = value; });

// Pre-validate hook to restrict admin creation/update unless a specific system secret matches
userSchema.pre('validate', function(next) {
    if (this.isModified('role') && this.role === 'admin') {
        const secret = process.env.ADMIN_CREATION_SECRET || 'super_secret_admin_creation_token_98765';
        if (this.adminSecret !== secret && this._adminSecret !== secret) {
            this.invalidate('role', 'Admin registration is restricted. A valid adminSecret must be provided.');
        }
    }
    next();
});

// Encrypt password using bcrypt and calculate profile completeness
userSchema.pre('save', async function (next) {
    // Handle password encryption
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    // Handle student profile completeness (Single Source of Truth Logic)
    if (this.role === 'student' && this.studentProfile) {
        const hasBasicInfo = this.name && this.studentProfile.branch && this.studentProfile.year;
        const hasSkills = this.studentProfile.skills && this.studentProfile.skills.length > 0;
        const hasResume = !!this.studentProfile.resumeUrl;

        this.studentProfile.isComplete = !!(hasBasicInfo && hasSkills && hasResume);
    }

    next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Optimization Indexes
userSchema.index({ role: 1, status: 1 });
userSchema.index({ "studentProfile.branch": 1 });
userSchema.index({ "studentProfile.year": 1 });

module.exports = mongoose.model('User', userSchema);
