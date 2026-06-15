const request = require('supertest');
require('./mocks');
const { app } = require('../app');
const dbHandler = require('./setup');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');

let student1Token, student2Token, oppId;

beforeAll(async () => {
    await dbHandler.connect();

    // Students
    const s1 = await request(app).post('/api/auth/register').send({
        name: 'Student 1',
        email: 's1@pict.edu',
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
    student1Token = s1.body.token;

    const s2 = await request(app).post('/api/auth/register').send({
        name: 'Student 2',
        email: 's2@pict.edu',
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
    student2Token = s2.body.token;

    // Create Opportunity directly
    const opp = await Opportunity.create({
        title: 'Project X',
        description: 'Hard project',
        type: 'project',
        deadline: new Date(),
        postedBy: new (require('mongoose').Types.ObjectId)(),
        branch: 'Computer Science'
    });
    oppId = opp._id;
});

afterAll(async () => await dbHandler.closeDatabase());

describe('Teams API', () => {
    let teamId;

    it('should create a new team for an opportunity', async () => {
        const res = await request(app)
            .post('/api/teams')
            .set('Authorization', `Bearer ${student1Token}`)
            .send({
                name: 'Alpha Team',
                opportunityId: oppId,
                role: 'Backend'
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.name).toBe('Alpha Team');
        teamId = res.body._id;
    });

    it('should allow student 1 (leader) to invite student 2', async () => {
        const res = await request(app)
            .post(`/api/teams/${teamId}/invite`)
            .set('Authorization', `Bearer ${student1Token}`)
            .send({
                identifier: 's2@pict.edu',
                role: 'Frontend'
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.members.length).toBe(2);
        expect(res.body.members[1].status).toBe('pending');
    });

    it('should allow student 2 to accept invitation', async () => {
        const res = await request(app)
            .put(`/api/teams/${teamId}/respond`)
            .set('Authorization', `Bearer ${student2Token}`)
            .send({ status: 'accepted' });

        expect(res.statusCode).toBe(200);
        const acceptedMember = res.body.members.find(m => m.status === 'accepted');
        expect(acceptedMember).toBeTruthy();
    });
});
