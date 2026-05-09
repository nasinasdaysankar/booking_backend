import jwt from 'jsonwebtoken';
import { generateToken, generateRefreshToken } from '../utils/jwt.js';
import { User, Admin } from '../models/index.js';

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cafeteria-refresh-secret-key';

export const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

        // For sliding session: generate BOTH new access and refresh tokens
        const { iat, exp, ...payload } = decoded;

        const accessToken = generateToken(payload);
        const newRefreshToken = generateRefreshToken(payload);

        return res.json({
            token: accessToken,
            refreshToken: newRefreshToken
        });
    } catch (err) {
        console.error('Refresh token verification failed:', err);
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
};
