import express from 'express';
import { register, login } from '../controllers/authController.js';
import { sendOTP, verifyOTP } from '../controllers/otpController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication APIs (Register, Login, OTP)
 */

/* ============================================================
   📌 REGISTER USER
============================================================ */
router.post('/register', register);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (student / staff / admin)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Uday" }
 *               email: { type: string, example: "uday@alliance.edu.in" }
 *               password: { type: string, example: "123456" }
 *               role: { type: string, example: "student" }
 *     responses:
 *       201: { description: User registered successfully }
 *       400: { description: Email already exists }
 */


/* ============================================================
   📌 NORMAL LOGIN (Password-based)
============================================================ */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user with email + password (returns JWT token)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "uday@alliance.edu.in" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Login successful (returns token) }
 *       400: { description: Invalid email or password }
 */


/* ============================================================
   🔥 OTP AUTHENTICATION (NO PASSWORD REQUIRED)
============================================================ */

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to Outlook University Email (@alliance.edu.in only)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: "student@alliance.edu.in" }
 *     responses:
 *       200: { description: OTP sent to university email }
 *       400: { description: Only university email allowed }
 */
router.post('/send-otp', sendOTP);


/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and login (returns token)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, example: "student@alliance.edu.in" }
 *               otp: { type: string, example: "846291" }
 *     responses:
 *       200: { description: OTP verified → Login success }
 *       400: { description: Invalid or expired OTP }
 */
router.post('/verify-otp', verifyOTP);


export default router;
