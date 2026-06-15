const request = require('supertest');
require('./mocks');
const { app } = require('../app');
const dbHandler = require('./setup');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');

let studentToken, companyToken;

beforeAll(async () => {
    await dbHandler.connect();

    // Register Student
    const sRes = await request(app).post('/api/auth/register').send({
        name: 'Student User',
        email: 's@pict.edu',
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
    studentToken = sRes.body.token;

    // Register Company (bypass domain check for this test by creating directly or using mock)
    // Actually company domain check is in settings. Let's create directly for speed.
    const company = await User.create({
        name: 'Google',
        email: 'hr@google.com',
        password: 'password123',
        role: 'company',
        status: 'approved' // Must be approved to post
    });
    const generateToken = require('../utils/generateToken');
    companyToken = generateToken(company._id, 'company');
});

afterAll(async () => await dbHandler.closeDatabase());

describe('Opportunities API', () => {
    let oppId;

    it('should allow company to create internship', async () => {
        const res = await request(app)
            .post('/api/opportunities')
            .set('Authorization', `Bearer ${companyToken}`)
            .send({
                title: 'Software Engineer Intern',
                description: 'Build cool stuff',
                type: 'internship',
                deadline: '2026-12-31',
                requiredSkills: ['React', 'Node'],
                eligibilityCriteria: { minYear: 3, minCGPA: 8 },
                branch: 'Computer Science'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.title).toBe('Software Engineer Intern');
        oppId = res.body._id;
    });

    it('should allow student to fetch all opportunities', async () => {
        const res = await request(app)
            .get('/api/opportunities')
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('should allow fetching a single opportunity', async () => {
        const res = await request(app)
            .get(`/api/opportunities/${oppId}`)
            .set('Authorization', `Bearer ${studentToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.title).toBe('Software Engineer Intern');
    });
});
