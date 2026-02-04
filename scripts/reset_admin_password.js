// import { Admin, sequelize } from '../src/models/index.js';
// import bcrypt from 'bcryptjs';

// const resetPassword = async () => {
//     try {
//         console.log("🔗 Connecting to database...");
//         await sequelize.authenticate();
//         console.log("✅ Database connected\n");

//         const staffId = 'STF-001';
//         const newPassword = 'admin123';
//         const hashedPassword = await bcrypt.hash(newPassword, 10);

//         const [updated] = await Admin.update(
//             { password: hashedPassword },
//             { where: { staffId } }
//         );

//         if (updated) {
//             console.log(`✅ Password for ${staffId} has been reset to: ${newPassword}`);
//         } else {
//             console.error(`❌ Admin with Staff ID ${staffId} not found.`);
//         }

//         process.exit(0);
//     } catch (error) {
//         console.error("Error resetting password:", error);
//         process.exit(1);
//     }
// };

// resetPassword();
