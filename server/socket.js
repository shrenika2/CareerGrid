const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const initSocket = (server) => {
    const io = socketio(server, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000, // Wait 60s for pong before closing
        pingInterval: 25000, // Ping every 25s
        connectTimeout: 45000,
        allowEIO3: true // Backward compatibility if needed
    });

    // Handle Socket.io instance errors
    io.on('error', (err) => {
        console.error('[SOCKET_IO] Global Error:', err.message);
        const Sentry = require("@sentry/node");
        if (process.env.SENTRY_DSN) Sentry.captureException(err);
    });

    const { registerWorkspaceSocket } = require('./modules/workspace');

    // JWT Authentication Middleware for Sockets
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select("-password");
            if (!user) {
                return next(new Error("Authentication error: User not found"));
            }

            if (user.status === 'blocked' || user.status === 'rejected') {
                return next(new Error("Authentication error: Account blocked or rejected"));
            }

            socket.user = user;
            next();
        } catch (err) {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.name} (${socket.id})`);

        // Register Workspace Handlers for this specific socket
        registerWorkspaceSocket(io, socket);

        // Join personal room for private notifications
        socket.join(socket.user._id.toString());

        // Community and notification rooms
        socket.on('join_room', (data) => {
            if (typeof data === 'string') {
                socket.join(data);
            } else if (data && data.room) {
                socket.join(data.room);
            } else if (data && data.communityId) {
                socket.join(data.communityId);
            }
        });

        socket.on('leave_room', (data) => {
            if (typeof data === 'string') {
                socket.leave(data);
            } else if (data && data.room) {
                socket.leave(data.room);
            } else if (data && data.communityId) {
                socket.leave(data.communityId);
            }
        });

        // Opportunity rooms for real-time practice updates
        socket.on('join_opportunity', (oppId) => {
            socket.join(`opportunity_${oppId}`);
        });

        socket.on('leave_opportunity', (oppId) => {
            socket.leave(`opportunity_${oppId}`);
        });

        // Faculty & Project specific real-time rooms
        if (socket.user.role === 'faculty') {
            socket.join(`faculty:${socket.user._id}`);
        }

        if (socket.user.role === 'company') {
            socket.join(`company:${socket.user._id}`);
        }

        socket.on('join_project', async (projectId) => {
            const { verifyProjectAccess } = require('./middleware/projectAuth');
            const auth = await verifyProjectAccess(projectId, socket.user._id, socket.user.role);

            if (auth.authorized) {
                socket.join(`project:${projectId}`);
            } else {
                socket.emit('error', { message: auth.message });
            }
        });

        socket.on('leave_project', (projectId) => {
            socket.leave(`project:${projectId}`);
        });

        socket.on('send_project_message', async (data) => {
            const { verifyProjectAccess } = require('./middleware/projectAuth');
            const auth = await verifyProjectAccess(data.projectId, socket.user._id, socket.user.role);

            if (auth.authorized) {
                io.to(`project:${data.projectId}`).emit('new_project_message', {
                    ...data,
                    sender: { _id: socket.user._id, name: socket.user.name, role: socket.user.role },
                    createdAt: new Date()
                });
            } else {
                socket.emit('error', { message: auth.message });
            }
        });

        socket.on('join_opportunity_chat', (oppId) => {
            socket.join(`opportunity_chat:${oppId}`);
        });

        socket.on('send_opportunity_message', (data) => {
            io.to(`opportunity_chat:${data.oppId}`).emit('new_opportunity_message', {
                ...data,
                sender: { _id: socket.user._id, name: socket.user.name, role: socket.user.role },
                createdAt: new Date()
            });
        });

        socket.on('leave_opportunity_chat', (oppId) => {
            socket.leave(`opportunity_chat:${oppId}`);
        });

        // AI Interview Handlers
        const interviewManager = require('./services/interviewManager');
        const Opportunity = require('./models/Opportunity');
        const aiService = require('./services/aiService');

        socket.on('interview:start', async (data) => {
            try {
                const opportunity = await Opportunity.findById(data.opportunityId);
                if (!opportunity) return socket.emit('interview:error', { message: 'Opportunity not found' });

                const candidateSkills = socket.user.studentProfile.parsedSkills || [];
                const systemPrompt = aiService.generateInterviewPrompt(
                    candidateSkills,
                    opportunity.requiredSkills || [],
                    opportunity.title
                );

                await interviewManager.startSession(socket.user._id.toString(), socket, opportunity, systemPrompt);
            } catch (err) {
                socket.emit('interview:error', { message: err.message });
            }
        });

        socket.on('interview:audio', (data) => {
            // data.audio is base64 PCM16
            interviewManager.handleClientAudio(socket.user._id.toString(), data.audio);
        });

        socket.on('interview:end', () => {
            interviewManager.cleanup(socket.user._id.toString(), true);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            interviewManager.cleanup(socket.user._id.toString());
        });
    });

    return io;
};

module.exports = initSocket;
