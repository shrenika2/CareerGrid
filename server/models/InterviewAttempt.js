const mongoose = require('mongoose');

const interviewAttemptSchema = mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        jobTitle: {
            type: String,
            required: true,
        },
        responses: [
            {
                question: String,
                answer: String,
                feedback: String,
            }
        ],
        score: {
            type: Number,
            required: true,
        },
        breakdown: {
            technical: Number,
            communication: Number,
        },
        completedAt: {
            type: Date,
            default: Date.now,
        }
    },
    {
        timestamps: true,
    }
);

interviewAttemptSchema.index({ student: 1, completedAt: -1 });

module.exports = mongoose.model('InterviewAttempt', interviewAttemptSchema);
