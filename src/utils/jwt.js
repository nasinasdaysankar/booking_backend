import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cafeteria-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cafeteria-refresh-secret-key';

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};
