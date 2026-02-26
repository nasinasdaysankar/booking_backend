import jwt from 'jsonwebtoken';
import { User, Admin } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cafeteria-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cafeteria-refresh-secret-key';

export const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

        // Check if it's a user or admin based on role or other payload property
        // For now, we'll just sign a new token with the same payload (minus iat/exp)
        const { iat, exp, ...payload } = decoded;

        const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

        return res.json({
            token: accessToken
        });
    } catch (err) {
        console.error('Refresh token verification failed:', err);
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
};
