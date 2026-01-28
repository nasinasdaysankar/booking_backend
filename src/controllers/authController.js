// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// import { User } from "../models/index.js";
// import admin from "../config/firebaseAdmin.js";


// dotenv.config();

// // Generate JWT Token
// const signToken = (user) => {
//   return jwt.sign(
//     { id: user.id, role: user.role },
//     process.env.JWT_SECRET,
//     { expiresIn: "7d" }
//   );
// };


// // export const googleLogin = async (req, res) => {
// //   try {
// //     const { idToken } = req.body;

// //     if (!idToken) {
// //       return res.status(400).json({ message: "ID token missing" });
// //     }

// //     // 🔐 Verify Firebase ID Token
// //     const decoded = await admin.auth().verifyIdToken(idToken);

// //     const email = decoded.email;
// //     const name = decoded.name || "Google User";

// //     // ✅ ONLY GOOGLE USERS — DEFAULT ROLE
// //     const role = "student";

// //     // 🔎 Find or create user
// //     let user = await User.findOne({ where: { email } });

// //     if (!user) {
// //       user = await User.create({
// //         name,
// //         email,
// //         role,               // ✅ ENUM SAFE
// //         passwordHash: null, // Google users don’t need password
// //       });
// //     }

// //     const token = signToken(user);

// //     return res.json({
// //       message: "Google login successful 🎉",
// //       token,
// //       user: {
// //         id: user.id,
// //         name: user.name,
// //         email: user.email,
// //         role: user.role,
// //       },
// //     });

// //   } catch (err) {
// //     console.error("❌ Google auth error:", err);
// //     return res.status(401).json({
// //       message: "Google authentication failed",
// //     });
// //   }
// // };
// export const googleLogin = async (req, res) => {
//   try {
//     const { idToken } = req.body;

//     // Verify Firebase token
//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     const { email, name, picture } = decodedToken;

//     let user = await User.findOne({ where: { email } });

//     if (!user) {
//       user = await User.create({
//         email,
//         name,
//         role: "student",
//         // phone will be null initially
//       });
//     }

//     const token = signToken(user);

//     return res.json({
//       message: "Google login successful",
//       token,
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,  // ✅ MAKE SURE THIS IS INCLUDED
//         role: user.role,
//       },
//     });
//   } catch (err) {
//     console.error("Google login error:", err);
//     return res.status(500).json({ message: "Google login failed" });
//   }
// };
// /* ===========================================================
//    📌 REGISTER ONLY UNIVERSITY EMAILS
//    - alliance.edu.in → FACULTY
//    - ced.alliance.edu.in → STUDENT
// =========================================================== */
// export const register = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     if (!name || !email || !password)
//       return res.status(400).json({ message: "All fields required ❗" });

//     const domain = email.split("@")[1]?.toLowerCase();

//     // ================= NEW DOMAIN LOGIC =================
//     let role;
//     if (domain === "alliance.edu.in") {
//       role = "faculty";
//     } else if (domain === "gmail.com") {
//       role = "student";
//     } else {
//       return res.status(400).json({
//         message: "Use @alliance.edu.in for Faculty or @gmail.com for Students."
//       });
//     }
//     // ===================================================

//     const existing = await User.findOne({ where: { email } });
//     if (existing)
//       return res.status(400).json({ message: "Email already registered ❗" });

//     const hash = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       name,
//       email,
//       passwordHash: hash,
//       role
//     });

//     const token = signToken(user);

//     res.status(201).json({
//       message: "Registration Successful 🎉",
//       token,
//       user: { id: user.id, name: user.name, email: user.email, role }
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Register error ❌" });
//   }
// };
// /* ===========================================================
//    📌 LOGIN (email + password)
// =========================================================== */
// export const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     const user = await User.findOne({ where: { email } });
//     if (!user) return res.status(400).json({ message: "Invalid email or password ❌" });

//     const ok = await bcrypt.compare(password, user.passwordHash);
//     if (!ok) return res.status(400).json({ message: "Invalid email or password ❌" });

//     const token = signToken(user);

//     res.json({
//       message: "Login Successful 🚀",
//       token,
//       user: { id: user.id, name: user.name, email: user.email, role: user.role }
//     });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Login error ❌" });
//   }
// };


// export const sendOtp = async (req, res) => {
//   console.log("📥 SEND OTP API HIT");
//   console.log("📦 Body:", req.body);

//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({ message: "Email required" });
//     }

//     let user = await User.findOne({ where: { email } });

//     if (!user) {
//       user = await User.create({
//         email,
//         role: "student",
//       });
//     }

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     user.otpCode = otp;
//     user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
//     await user.save();

//     // ✅ SEND EMAIL
//     await transporter.sendMail({
//       from: `"Velish App" <${process.env.EMAIL_USER}>`,
//       to: email,
//       subject: "Your OTP for Velish Login",
//       html: `
//         <h2>Velish Login OTP</h2>
//         <p>Your OTP is:</p>
//         <h1 style="letter-spacing: 5px;">${otp}</h1>
//         <p>This OTP will expire in 5 minutes.</p>
//       `,
//     });

//     console.log("📧 OTP EMAIL SENT TO:", email);

//     return res.status(200).json({
//       message: "OTP sent successfully",
//     });

//   } catch (err) {
//     console.error("🔥 SEND OTP ERROR:", err);
//     return res.status(500).json({ message: "OTP send failed" });
//   }
// };
// export const verifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     const user = await User.findOne({ where: { email } });
//     if (!user) return res.status(400).json({ message: "User not found" });

//     if (
//       user.otpCode !== otp ||
//       !user.otpExpiry ||
//       new Date() > user.otpExpiry
//     ) {
//       return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     user.otpCode = null;
//     user.otpExpiry = null;
//     await user.save();

//     const token = signToken(user);

//     res.json({
//       message: "Login successful 🎉",
//       token,
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "OTP verification failed" });
//   }
// };


// // import bcrypt from "bcryptjs";
// // import jwt from "jsonwebtoken";
// // import dotenv from "dotenv";
// // import { User } from "../models/index.js";
// // import admin from "../config/firebaseAdmin.js";

// // dotenv.config();

// // /* ================= TOKEN ================= */
// // const signToken = (user) => {
// //   return jwt.sign(
// //     { id: user.id, role: user.role },
// //     process.env.JWT_SECRET,
// //     { expiresIn: "7d" }
// //   );
// // };

// // /* ================= SEND OTP VIA PUSH ================= */
// // export const sendOtp = async (req, res) => {
// //   console.log("📥 PUSH OTP API HIT");
// //   console.log("📦 Body:", req.body);

// //   try {
// //     const { email } = req.body;
// //     if (!email) {
// //       return res.status(400).json({ message: "Email required" });
// //     }

// //     const user = await User.findOne({ where: { email } });

// //     if (!user || !user.fcmToken) {
// //       return res.status(400).json({
// //         message: "User or FCM token not found. Login once to register device.",
// //       });
// //     }

// //     // 🔐 Generate OTP
// //     const otp = Math.floor(100000 + Math.random() * 900000).toString();

// //     user.otpCode = otp;
// //     user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
// //     await user.save();

// //     // 📲 PUSH NOTIFICATION
// //     await admin.messaging().send({
// //       token: user.fcmToken,
// //       notification: {
// //         title: "Velish Login OTP",
// //         body: `Your OTP is ${otp}`,
// //       },
// //       data: {
// //         type: "OTP",
// //       },
// //     });

// //     console.log("📲 OTP PUSH SENT");

// //     return res.json({
// //       message: "OTP sent via push notification",
// //     });

// //   } catch (err) {
// //     console.error("🔥 PUSH OTP ERROR:", err);
// //     return res.status(500).json({ message: "OTP send failed" });
// //   }
// // };

// // /* ================= VERIFY OTP ================= */
// // export const verifyOtp = async (req, res) => {
// //   try {
// //     const { email, otp } = req.body;

// //     const user = await User.findOne({ where: { email } });
// //     if (!user) {
// //       return res.status(400).json({ message: "User not found" });
// //     }

// //     if (
// //       user.otpCode !== otp ||
// //       !user.otpExpiry ||
// //       new Date() > user.otpExpiry
// //     ) {
// //       return res.status(400).json({ message: "Invalid or expired OTP" });
// //     }

// //     // ✅ Clear OTP
// //     user.otpCode = null;
// //     user.otpExpiry = null;
// //     await user.save();

// //     const token = signToken(user);

// //     return res.json({
// //       message: "Login successful 🎉",
// //       token,
// //       user: {
// //         id: user.id,
// //         email: user.email,
// //         role: user.role,
// //       },
// //     });

// //   } catch (err) {
// //     console.error(err);
// //     return res.status(500).json({ message: "OTP verification failed" });
// //   }
// // };
// // // POST /api/auth/save-fcm
// // export const saveFcmForOtp = async (req, res) => {
// //   const { email, fcmToken } = req.body;

// //   if (!email || !fcmToken) {
// //     return res.status(400).json({ message: "Email and FCM required" });
// //   }

// //   let user = await User.findOne({ where: { email } });

// //   if (!user) {
// //     user = await User.create({ email, role: "student" });
// //   }

// //   user.fcmToken = fcmToken;
// //   await user.save();

// //   return res.json({ message: "FCM token registered" });
// // };


import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { User } from "../models/index.js";
import admin from "../config/firebaseAdmin.js";


dotenv.config();

// Generate JWT Token
const signToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};


// export const googleLogin = async (req, res) => {
//   try {
//     const { idToken } = req.body;

//     if (!idToken) {
//       return res.status(400).json({ message: "ID token missing" });
//     }

//     // 🔐 Verify Firebase ID Token
//     const decoded = await admin.auth().verifyIdToken(idToken);

//     const email = decoded.email;
//     const name = decoded.name || "Google User";

//     // ✅ ONLY GOOGLE USERS — DEFAULT ROLE
//     const role = "student";

//     // 🔎 Find or create user
//     let user = await User.findOne({ where: { email } });

//     if (!user) {
//       user = await User.create({
//         name,
//         email,
//         role,               // ✅ ENUM SAFE
//         passwordHash: null, // Google users don’t need password
//       });
//     }

//     const token = signToken(user);

//     return res.json({
//       message: "Google login successful 🎉",
//       token,
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     });

//   } catch (err) {
//     console.error("❌ Google auth error:", err);
//     return res.status(401).json({
//       message: "Google authentication failed",
//     });
//   }
// };
export const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    // ✅ VALIDATION: Check if idToken is provided
    if (!idToken) {
      console.error("❌ Google login: Missing idToken in request body");
      return res.status(400).json({
        success: false,
        message: "ID token is required",
        code: "MISSING_TOKEN"
      });
    }

    let decodedToken;
    try {
      // Verify Firebase token with checkRevoked option to catch revoked tokens
      decodedToken = await admin.auth().verifyIdToken(idToken, true);
    } catch (firebaseError) {
      // ✅ DETAILED Firebase error handling
      console.error("❌ Firebase token verification failed:", {
        code: firebaseError.code,
        message: firebaseError.message,
      });

      // Handle specific Firebase Auth errors
      if (firebaseError.code === 'auth/id-token-expired') {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please sign in again.",
          code: "TOKEN_EXPIRED"
        });
      }
      if (firebaseError.code === 'auth/id-token-revoked') {
        return res.status(401).json({
          success: false,
          message: "Token has been revoked. Please sign in again.",
          code: "TOKEN_REVOKED"
        });
      }
      if (firebaseError.code === 'auth/argument-error') {
        return res.status(400).json({
          success: false,
          message: "Invalid token format",
          code: "INVALID_TOKEN"
        });
      }
      if (firebaseError.code === 'auth/invalid-id-token') {
        return res.status(400).json({
          success: false,
          message: "Invalid ID token provided",
          code: "INVALID_TOKEN"
        });
      }

      // Generic auth failure for other Firebase errors
      return res.status(401).json({
        success: false,
        message: "Authentication failed. Please try again.",
        code: "AUTH_FAILED"
      });
    }

    const { email, name, picture, uid } = decodedToken;

    // ✅ Validate email exists in token
    if (!email) {
      console.error("❌ Firebase token missing email for uid:", uid);
      return res.status(400).json({
        success: false,
        message: "Google account email not available",
        code: "NO_EMAIL"
      });
    }

    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create user without googleId first (in case column doesn't exist)
      const userData = {
        email,
        name: name || "User",
        role: "student",
      };

      // Try to add googleId, but don't fail if column doesn't exist
      try {
        userData.googleId = uid;
        user = await User.create(userData);
        console.log(`✅ New Google user created: ${email} (uid: ${uid})`);
      } catch (createError) {
        // If googleId column doesn't exist, create without it
        if (createError.message?.includes('googleId') || createError.name === 'SequelizeDatabaseError') {
          console.warn(`⚠️ googleId column may not exist, creating user without it`);
          delete userData.googleId;
          user = await User.create(userData);
          console.log(`✅ New Google user created (without googleId): ${email}`);
        } else {
          throw createError; // Re-throw if it's a different error
        }
      }
    } else {
      // ✅ Update googleId if not already set (for existing users migrating to Google login)
      if (!user.googleId && uid) {
        try {
          await user.update({ googleId: uid });
          console.log(`✅ Updated googleId for existing user: ${email}`);
        } catch (updateError) {
          // If googleId column doesn't exist, just log and continue
          console.warn(`⚠️ Could not update googleId (column may not exist): ${email}`);
        }
      }
    }

    const token = signToken(user);

    console.log(`✅ Google login successful: ${email}`);

    return res.json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    // ✅ Detailed error logging for debugging
    console.error("❌ Google login error:", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      success: false,
      message: "Server error during login. Please try again.",
      code: "SERVER_ERROR"
    });
  }
};
/* ===========================================================
   📌 REGISTER ONLY UNIVERSITY EMAILS
   - alliance.edu.in → FACULTY
   - ced.alliance.edu.in → STUDENT
=========================================================== */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required ❗" });

    const domain = email.split("@")[1]?.toLowerCase();

    // ================= NEW DOMAIN LOGIC =================
    let role;
    if (domain === "alliance.edu.in") {
      role = "faculty";
    } else if (domain === "gmail.com") {
      role = "student";
    } else {
      return res.status(400).json({
        message: "Use @alliance.edu.in for Faculty or @gmail.com for Students."
      });
    }
    // ===================================================

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "Email already registered ❗" });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash: hash,
      role
    });

    const token = signToken(user);

    res.status(201).json({
      message: "Registration Successful 🎉",
      token,
      user: { id: user.id, name: user.name, email: user.email, role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Register error ❌" });
  }
};
/* ===========================================================
   📌 LOGIN (email + password)
=========================================================== */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid email or password ❌" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Invalid email or password ❌" });

    const token = signToken(user);

    res.json({
      message: "Login Successful 🚀",
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Login error ❌" });
  }
};


export const sendOtp = async (req, res) => {
  console.log("📥 SEND OTP API HIT");
  console.log("📦 Body:", req.body);

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    let user = await User.findOne({ where: { email } });

    if (!user) {
      user = await User.create({
        email,
        role: "student",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otpCode = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // ✅ SEND EMAIL
    await transporter.sendMail({
      from: `"Velish App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP for Velish Login",
      html: `
        <h2>Velish Login OTP</h2>
        <p>Your OTP is:</p>
        <h1 style="letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 5 minutes.</p>
      `,
    });

    console.log("📧 OTP EMAIL SENT TO:", email);

    return res.status(200).json({
      message: "OTP sent successfully",
    });

  } catch (err) {
    console.error("🔥 SEND OTP ERROR:", err);
    return res.status(500).json({ message: "OTP send failed" });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (
      user.otpCode !== otp ||
      !user.otpExpiry ||
      new Date() > user.otpExpiry
    ) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    user.otpCode = null;
    user.otpExpiry = null;
    await user.save();

    const token = signToken(user);

    res.json({
      message: "Login successful 🎉",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "OTP verification failed" });
  }
};


// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// import { User } from "../models/index.js";
// import admin from "../config/firebaseAdmin.js";

// dotenv.config();

// /* ================= TOKEN ================= */
// const signToken = (user) => {
//   return jwt.sign(
//     { id: user.id, role: user.role },
//     process.env.JWT_SECRET,
//     { expiresIn: "7d" }
//   );
// };

// /* ================= SEND OTP VIA PUSH ================= */
// export const sendOtp = async (req, res) => {
//   console.log("📥 PUSH OTP API HIT");
//   console.log("📦 Body:", req.body);

//   try {
//     const { email } = req.body;
//     if (!email) {
//       return res.status(400).json({ message: "Email required" });
//     }

//     const user = await User.findOne({ where: { email } });

//     if (!user || !user.fcmToken) {
//       return res.status(400).json({
//         message: "User or FCM token not found. Login once to register device.",
//       });
//     }

//     // 🔐 Generate OTP
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();

//     user.otpCode = otp;
//     user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
//     await user.save();

//     // 📲 PUSH NOTIFICATION
//     await admin.messaging().send({
//       token: user.fcmToken,
//       notification: {
//         title: "Velish Login OTP",
//         body: `Your OTP is ${otp}`,
//       },
//       data: {
//         type: "OTP",
//       },
//     });

//     console.log("📲 OTP PUSH SENT");

//     return res.json({
//       message: "OTP sent via push notification",
//     });

//   } catch (err) {
//     console.error("🔥 PUSH OTP ERROR:", err);
//     return res.status(500).json({ message: "OTP send failed" });
//   }
// };

// /* ================= VERIFY OTP ================= */
// export const verifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;

//     const user = await User.findOne({ where: { email } });
//     if (!user) {
//       return res.status(400).json({ message: "User not found" });
//     }

//     if (
//       user.otpCode !== otp ||
//       !user.otpExpiry ||
//       new Date() > user.otpExpiry
//     ) {
//       return res.status(400).json({ message: "Invalid or expired OTP" });
//     }

//     // ✅ Clear OTP
//     user.otpCode = null;
//     user.otpExpiry = null;
//     await user.save();

//     const token = signToken(user);

//     return res.json({
//       message: "Login successful 🎉",
//       token,
//       user: {
//         id: user.id,
//         email: user.email,
//         role: user.role,
//       },
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "OTP verification failed" });
//   }
// };
// // POST /api/auth/save-fcm
// export const saveFcmForOtp = async (req, res) => {
//   const { email, fcmToken } = req.body;

//   if (!email || !fcmToken) {
//     return res.status(400).json({ message: "Email and FCM required" });
//   }

//   let user = await User.findOne({ where: { email } });

//   if (!user) {
//     user = await User.create({ email, role: "student" });
//   }

//   user.fcmToken = fcmToken;
//   await user.save();

//   return res.json({ message: "FCM token registered" });
// };
