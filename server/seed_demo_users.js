const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config({ path: '.env' });

const seedDemoUsers = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/CareerGrid';
        console.log('Connecting to MongoDB at:', mongoUri);
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB.');

        // Demo users data
        const demoUsers = [
            {
                name: 'Demo Student',
                email: 'student@example.com',
                password: 'password123',
                role: 'student',
                status: 'approved',
                isVerified: true,
                studentProfile: {
                    collegeId: 'STUD123',
                    college: 'WCE Sangli',
                    branch: 'Computer Science',
                    year: 4,
                    cgpa: 9.2,
                    skills: ['React', 'Node.js', 'MongoDB', 'Python'],
                    isComplete: true
                }
            },
            {
                name: 'Demo Student Edu',
                email: 'student@college.edu',
                password: 'password123',
                role: 'student',
                status: 'approved',
                isVerified: true,
                studentProfile: {
                    collegeId: 'STUD456',
                    college: 'WCE Sangli',
                    branch: 'Computer Science',
                    year: 4,
                    cgpa: 9.0,
                    skills: ['React', 'Node.js', 'Express', 'Python'],
                    isComplete: true
                }
            },
            {
                name: 'Demo Employer',
                email: 'employer@example.com',
                password: 'password123',
                role: 'company',
                status: 'approved',
                isVerified: true,
                companyProfile: {
                    companyName: 'InternMatch AI Corp',
                    website: 'https://internmatch.ai',
                    industry: 'Technology',
                    location: 'San Francisco, CA',
                    description: 'AI-powered talent matching ecosystem'
                }
            },
            {
                name: 'Demo Faculty',
                email: 'faculty@example.com',
                password: 'password123',
                role: 'faculty',
                status: 'approved',
                isVerified: true,
                facultyProfile: {
                    department: 'Computer Science & Engineering',
                    designation: 'Assistant Professor'
                }
            },
            {
                name: 'Demo Admin',
                email: 'admin@example.com',
                password: 'password123',
                role: 'admin',
                status: 'approved',
                isVerified: true
            },
            {
                name: 'System Administrator',
                email: 'admin@careergrid.com',
                password: 'Admin@12345',
                role: 'admin',
                status: 'approved',
                isVerified: true
            }
        ];

        for (const userData of demoUsers) {
            const existingUser = await User.findOne({ email: userData.email });
            if (existingUser) {
                console.log(`User already exists, deleting first: ${userData.email}`);
                await User.deleteOne({ email: userData.email });
            }
            
            // Password hashing will be done by mongoose pre-save hook
            if (userData.role === 'admin') {
                userData.adminSecret = process.env.ADMIN_CREATION_SECRET || 'super_secret_admin_creation_token_98765';
            }
            await User.create(userData);
            console.log(`Created user: ${userData.email} (${userData.role})`);
        }

        // Seed Opportunities for Demo Employer
        const Opportunity = require('./models/Opportunity');
        await Opportunity.deleteMany({});
        console.log('Cleared existing opportunities.');

        const employer = await User.findOne({ email: 'employer@example.com' });
        if (employer) {
            const demoOpps = [
                {
                    title: 'Frontend Developer Intern',
                    description: 'Build modern React/Vite client features, optimize web performance, integrate CSS layouts.',
                    type: 'internship',
                    postedBy: employer._id,
                    requiredSkills: ['React', 'CSS', 'JavaScript'],
                    eligibilityCriteria: {
                        minYear: 3,
                        minCGPA: 8.0,
                        branches: ['Computer Science']
                    },
                    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'open',
                    location: 'Remote',
                    stipend: '₹25,000 / Month',
                    branch: 'Computer Science'
                },
                {
                    title: 'Backend Engineer Intern',
                    description: 'Design REST APIs with Node.js, Express, MongoDB. Build microservices and handle databases.',
                    type: 'internship',
                    postedBy: employer._id,
                    requiredSkills: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
                    eligibilityCriteria: {
                        minYear: 3,
                        minCGPA: 8.0,
                        branches: ['Computer Science']
                    },
                    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'open',
                    location: 'Remote',
                    stipend: '₹30,000 / Month',
                    branch: 'Computer Science'
                }
            ];

            for (const opp of demoOpps) {
                await Opportunity.create(opp);
                console.log(`Created opportunity: ${opp.title}`);
            }
        }

        console.log('Seeding demo users and opportunities completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding demo users:', err);
        process.exit(1);
    }
};

seedDemoUsers();
