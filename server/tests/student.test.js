const request = require('supertest');
require('./mocks');
const { app } = require('../app');
const dbHandler = require('./setup');
const User = require('../models/User');

let token;
let userId;

beforeAll(async () => {
    await dbHandler.connect();
    // Create a user and get token
    const res = await request(app)
        .post('/api/auth/register')
        .send({
            name: 'Profile User',
            email: 'profile@pict.edu',
            password: 'password123',
            role: 'student',
            studentProfile: {
                branch: 'Computer Science',
                year: 3,
                college: 'PICT',
                cgpa: 8.5,
                skills: ['React', 'Node']
            }
        });
    token = res.body.token;
    userId = res.body._id;
});

afterAll(async () => await dbHandler.closeDatabase());

describe('Student Profile API', () => {
    const profileUpdate = {
        fullName: 'Updated Name',
        branch: 'Computer Science',
        year: 3,
        collegeId: '2021CS001',
        college: 'PICT',
        resumeUrl: 'https://test.com/resume.pdf',
        skills: ['JavaScript', 'Node.js']
    };

    it('should fetch own empty profile', async () => {
        const res = await request(app)
            .get('/api/student-profile/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.user.name).toBe('Profile User');
    });

    it('should update student profile', async () => {
        const res = await request(app)
            .post('/api/student-profile/me')
            .set('Authorization', `Bearer ${token}`)
            .send(profileUpdate);

        expect(res.statusCode).toBe(200);
        expect(res.body.fullName).toBe(profileUpdate.fullName);
        expect(res.body.branch).toBe(profileUpdate.branch);
        expect(res.body.skills).toContain('JavaScript');
    });

    it('should reject profile update for unauthorized users', async () => {
        const res = await request(app)
            .post('/api/student-profile/me')
            .send(profileUpdate);

        expect(res.statusCode).toBe(401);
    });

    it('should auto-calculate profile completeness', async () => {
        const user = await User.findById(userId);
        expect(user.studentProfile.isComplete).toBe(true);
    });
});
