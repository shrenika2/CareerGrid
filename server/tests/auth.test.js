const request = require('supertest');
require('./mocks');
const { app } = require('../app');
const dbHandler = require('./setup');
const User = require('../models/User');

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clearDatabase());
afterAll(async () => await dbHandler.closeDatabase());

describe('Authentication API', () => {
    const studentData = {
        name: 'Test Student',
        email: 'student@pict.edu',
        password: 'password123',
        role: 'student',
        studentProfile: {
            branch: 'Computer Science',
            year: 3,
            college: 'PICT',
            cgpa: 8.5,
            skills: ['React', 'Node']
        }
    };

    describe('POST /api/auth/register', () => {
        it('should register a new student with .edu domain', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send(studentData);

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body.email).toBe(studentData.email);

            const user = await User.findOne({ email: studentData.email });
            expect(user).toBeTruthy();
        });

        it('should reject student registration with non-edu domain', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ ...studentData, email: 'fake@gmail.com' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('college (.edu) email');
        });

        it('should reject duplicate registration', async () => {
            await User.create(studentData);

            const res = await request(app)
                .post('/api/auth/register')
                .send(studentData);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toBe('User already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            await User.create(studentData);
        });

        it('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: studentData.email,
                    password: studentData.password
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
        });

        it('should reject invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: studentData.email,
                    password: 'wrongpassword'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });
    });
});
