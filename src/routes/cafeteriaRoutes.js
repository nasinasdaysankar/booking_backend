// import express from 'express';
// import { auth } from '../middleware/auth.js';
// import { getCafeterias, getCafeteriaMenu } from '../controllers/cafeteriaController.js';

// const router = express.Router();

// /**
//  * @swagger
//  * tags:
//  *   name: Cafeterias
//  *   description: Cafeteria & menu APIs
//  */

// /**
//  * @swagger
//  * /api/cafeterias:
//  *   get:
//  *     summary: Get list of cafeterias
//  *     tags: [Cafeterias]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200: { description: List returned }
//  */
// router.get('/', auth, getCafeterias);

// /**
//  * @swagger
//  * /api/cafeterias/{id}/menu:
//  *   get:
//  *     summary: Get menu for a cafeteria
//  *     tags: [Cafeterias]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema: { type: number }
//  *         example: 1
//  *     responses:
//  *       200: { description: Menu fetched }
//  */
// router.get('/:id/menu', auth, getCafeteriaMenu);

// export default router;


import express from 'express';
import { auth } from '../middleware/auth.js';
import { getCafeterias, getCafeteriaMenu } from '../controllers/cafeteriaController.js';
import { SystemSetting } from '../models/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Cafeterias
 *   description: Cafeteria & menu APIs
 */

/**
 * @swagger
 * /api/cafeterias:
 *   get:
 *     summary: Get list of cafeterias
 *     tags: [Cafeterias]
 *     responses:
 *       200: { description: List returned }
 */
// ✅ REMOVED auth middleware - public endpoint
router.get('/', getCafeterias);

/**
 * @swagger
 * /api/cafeterias/{id}/menu:
 *   get:
 *     summary: Get menu for a cafeteria
 *     tags: [Cafeterias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: number }
 *         example: 1
 *     responses:
 *       200: { description: Menu fetched }
 */
router.get('/:id/menu', auth, getCafeteriaMenu);

/**
 * @swagger
 * /api/cafeterias/quote:
 *   get:
 *     summary: Get the current daily quote
 *     tags: [Cafeterias]
 *     responses:
 *       200: { description: Quote fetched }
 */
router.get('/quote', async (req, res) => {
    try {
        // Determine today's day number: 1=Monday … 7=Sunday
        const jsDay = new Date().getDay(); // 0=Sun,1=Mon…6=Sat
        const todayNum = jsDay === 0 ? 7 : jsDay;

        const [textSetting, imageSetting, authorSetting] = await Promise.all([
            SystemSetting.findOne({ where: { key: `QUOTE_DAY_${todayNum}` } }),
            SystemSetting.findOne({ where: { key: `QUOTE_IMAGE_DAY_${todayNum}` } }),
            SystemSetting.findOne({ where: { key: `QUOTE_AUTHOR_DAY_${todayNum}` } })
        ]);

        res.json({
            success: true,
            data: {
                quote: textSetting ? textSetting.value : 'Enjoy your meal!',
                imageUrl: imageSetting ? imageSetting.value : '',
                authorName: authorSetting ? authorSetting.value : ''
            }
        });
    } catch (error) {
        console.error('Public fetch daily quote error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch daily quote' });
    }
});


/**
 * @swagger
 * /api/cafeterias/public-settings:
 *   get:
 *     summary: Get all public global system settings
 *     tags: [Cafeterias]
 *     responses:
 *       200: { description: Settings fetched }
 */
router.get('/public-settings', async (req, res) => {
    try {
        const settings = await SystemSetting.findAll({ where: { isPublic: true } });
        const settingsMap = {};
        
        settings.forEach(s => {
            let val = s.value;
            if (s.type === 'BOOLEAN') val = (val === 'true');
            else if (s.type === 'NUMBER') val = Number(val);
            else if (s.type === 'JSON') {
                try {
                    val = JSON.parse(val);
                } catch (e) {
                    console.error(`Error parsing JSON setting ${s.key}:`, e);
                }
            }
            settingsMap[s.key] = val;
        });

        res.json({
            success: true,
            data: settingsMap
        });
    } catch (error) {
        console.error('Public fetch settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch global settings' });
    }
});

export default router;