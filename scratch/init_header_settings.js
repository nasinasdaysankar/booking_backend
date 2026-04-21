import { SystemSetting } from '../src/models/index.js';

async function initHeaderSettings() {
    console.log('🚀 Initializing Header Settings...');
    
    const settings = [
        {
            key: 'APP_HEADER_COLOR_1',
            value: '#111832',
            type: 'STRING',
            description: 'Primary gradient color for the mobile app header',
            group: 'DESIGN',
            isPublic: true
        },
        {
            key: 'APP_HEADER_COLOR_2',
            value: '#263B7A',
            type: 'STRING',
            description: 'Secondary gradient color for the mobile app header',
            group: 'DESIGN',
            isPublic: true
        },
        {
            key: 'APP_HEADER_PROMO_MEDIA_URL',
            value: '',
            type: 'STRING',
            description: 'URL for the promotional banner image or video in the header',
            group: 'DESIGN',
            isPublic: true
        },
        {
            key: 'APP_HEADER_PROMO_TYPE',
            value: 'image',
            type: 'STRING',
            description: 'Type of media for the header banner (image or video)',
            group: 'DESIGN',
            isPublic: true
        }
    ];

    for (const s of settings) {
        const [setting, created] = await SystemSetting.findOrCreate({
            where: { key: s.key },
            defaults: s
        });
        
        if (created) {
            console.log(`✅ Created ${s.key}`);
        } else {
            // Update to public if it wasn't
            await setting.update({ isPublic: true, group: 'DESIGN' });
            console.log(`ℹ️ ${s.key} already exists (ensured public/group)`);
        }
    }
    
    console.log('✨ All Header Settings Initialized!');
    process.exit(0);
}

initHeaderSettings().catch(err => {
    console.error('❌ Error initializing settings:', err);
    process.exit(1);
});
