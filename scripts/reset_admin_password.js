import { Admin, sequelize } from '../src/models/index.js';
import bcrypt from 'bcryptjs';

const resetPassword = async () => {
    try {
        console.log("🔗 Connecting to database...");
        await sequelize.authenticate();
        console.log("✅ Database connected\n");

        // List all admins first
        const allAdmins = await Admin.findAll({
            attributes: ['id', 'staffId', 'name', 'role', 'cafeteriaId']
        });

        console.log("📋 All admins in database:");
        allAdmins.forEach(admin => {
            console.log(`   ID: ${admin.id}, StaffId: ${admin.staffId}, Name: ${admin.name}, Role: ${admin.role}`);
        });
        console.log("");

        const staffId = 'STF-001';
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        console.log(`🔄 Resetting password for ${staffId}...`);

        const [updated] = await Admin.update(
            { password: hashedPassword },
            { where: { staffId } }
        );

        if (updated) {
            console.log(`✅ Password for ${staffId} has been reset to: ${newPassword}`);
        } else {
            console.error(`❌ Admin with Staff ID ${staffId} not found.`);
        }

        // Verify the password was updated correctly
        const admin = await Admin.findOne({ where: { staffId } });
        if (admin) {
            const testMatch = await bcrypt.compare(newPassword, admin.password);
            console.log(`🔍 Password verification test: ${testMatch ? '✅ PASS' : '❌ FAIL'}`);
        }

        process.exit(0);
    } catch (error) {
        console.error("Error resetting password:", error);
        process.exit(1);
    }
};

resetPassword();
