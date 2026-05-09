import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cafeteria-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cafeteria-refresh-secret-key';

export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d' // Increased from 7d
  });
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '365d' // Increased from 7d to 1 year
  });
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};
