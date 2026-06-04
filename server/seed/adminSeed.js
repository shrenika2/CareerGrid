const User = require('../models/User');
const logger = require('../utils/logger');

const seedAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            logger.warn('[SEED] Admin credentials not found in environment variables. Skipping admin seed.');
            return;
        }

        const adminExists = await User.findOne({ email: adminEmail });

        if (adminExists) {
            logger.info('[SEED] Admin already exists');
            return;
        }

        await User.create({
            name: 'System Administrator',
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            status: 'approved',
            isVerified: true,
            adminSecret: process.env.ADMIN_CREATION_SECRET || 'super_secret_admin_creation_token_98765'
        });

        logger.info('[SEED] Admin seeded successfully');
    } catch (error) {
        logger.error(`[SEED] Error seeding admin: ${error.message}`);
    }
};

module.exports = seedAdmin;
