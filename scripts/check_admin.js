// import { Admin, sequelize } from '../src/models/index.js';

// const checkAdmin = async () => {
//     try {
//         console.log("🔗 Connecting to database...");
//         await sequelize.authenticate();
//         console.log("✅ Database connected\n");

//         const admins = await Admin.findAll();

//         if (admins.length > 0) {
//             console.log("✅ FOUND EXISTING ADMINS:");
//             admins.forEach(admin => {
//                 console.log(`--------------------------------`);
//                 console.log(`STAFF ID: ${admin.staffId}`);
//                 console.log(`CAFETERIA ID: ${admin.cafeteriaId}`);
//                 console.log(`ROLE: ${admin.role}`);
//                 console.log(`(Password is hashed, cannot be retrieved)`);
//             });
//             console.log(`--------------------------------\n`);
//         } else {
//             console.log("❌ No admins found in database.");
//         }

//         process.exit(0);
//     } catch (error) {
//         console.error("Error checking admins:", error);
//         process.exit(1);
//     }
// };

// checkAdmin();
