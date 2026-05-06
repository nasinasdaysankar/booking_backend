import express from 'express';
import { 
    getRandomAffiliateProduct, 
    getAllAffiliateProducts, 
    createAffiliateProduct, 
    bulkCreateAffiliateProducts,
    deleteAffiliateProduct, 
    extractAffiliateData 
} from '../controllers/affiliateController.js';
import { superadminAuth } from '../middleware/auth.js';

const router = express.Router();

// Public / User Endpoints
router.get('/random', getRandomAffiliateProduct);

// Admin Endpoints
router.get('/admin/all', superadminAuth, getAllAffiliateProducts);
router.post('/admin/create', superadminAuth, createAffiliateProduct);
router.post('/admin/bulk-create', superadminAuth, bulkCreateAffiliateProducts);
router.delete('/admin/:id', superadminAuth, deleteAffiliateProduct);
router.post('/admin/extract', superadminAuth, extractAffiliateData);

export default router;
