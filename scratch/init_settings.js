
import { SystemSetting } from '../src/models/index.js';

async function initSettings() {
    try {
        const [setting, created] = await SystemSetting.findOrCreate({
            where: { key: 'CAMPUS_TABS_ENABLED' },
            defaults: {
                value: 'false',
                type: 'BOOLEAN',
                description: 'Enable or disable In-Campus / Out-Campus tabs on the home screen',
                group: 'GENERAL',
                isPublic: true
            }
        });

        if (created) {
            console.log('✅ CAMPUS_TABS_ENABLED setting created');
        } else {
            console.log('ℹ️ CAMPUS_TABS_ENABLED setting already exists');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Error initializing settings:', error);
        process.exit(1);
    }
}

initSettings();
