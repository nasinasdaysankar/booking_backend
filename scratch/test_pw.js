import { sequelize, Admin } from './src/models/index.js';
import bcrypt from 'bcryptjs';

async function testPassword() {
  try {
    const admin = await Admin.findByPk(38);
    if (!admin) {
      console.log('❌ Admin 38 not found');
      return;
    }

    console.log('📋 Admin ID:', admin.id);
    console.log('📋 Staff ID:', admin.staffId);
    console.log('📋 Current Hash:', admin.password);

    const testPasswords = ['123456', 'admin123', '321', '321321']; // Common test passwords
    for (const pw of testPasswords) {
      const match = await bcrypt.compare(pw, admin.password);
      console.log(`🔍 Testing "${pw}": ${match ? '✅ MATCH' : '❌ MISMATCH'}`);
    }

    const newPw = 'test123';
    const newHash = await bcrypt.hash(newPw, 10);
    console.log(`✨ Generated new hash for "${newPw}":`, newHash);
    const verifyNew = await bcrypt.compare(newPw, newHash);
    console.log(`✅ Verification of new hash: ${verifyNew}`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await sequelize.close();
  }
}

testPassword();
