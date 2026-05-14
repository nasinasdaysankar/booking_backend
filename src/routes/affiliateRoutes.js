import express from 'express';
import { 
    getRandomAffiliateProduct, 
    getAllAffiliateProducts, 
    createAffiliateProduct, 
    bulkCreateAffiliateProducts,
    deleteAffiliateProduct, 
    extractAffiliateData,
    getAffiliateStatus,
    toggleAffiliateStatus,
    claimAffiliateReward,
    getUserRewards,
    toggleProductStatus
} from '../controllers/affiliateController.js';
import { superadminAuth, auth } from '../middleware/auth.js';
import { eitherAdminAuth } from '../middleware/auth.js';

const router = express.Router();

// Public / User Endpoints
router.get('/random', getRandomAffiliateProduct);
router.post('/claim', claimAffiliateReward);
router.get('/my-rewards', auth, getUserRewards);

// Admin Endpoints
router.get('/admin/all', superadminAuth, getAllAffiliateProducts);
router.post('/admin/create', superadminAuth, createAffiliateProduct);
router.post('/admin/bulk-create', superadminAuth, bulkCreateAffiliateProducts);
router.delete('/admin/:id', superadminAuth, deleteAffiliateProduct);
router.post('/admin/extract', superadminAuth, extractAffiliateData);
router.get('/admin/status', superadminAuth, getAffiliateStatus);
router.post('/admin/toggle', superadminAuth, toggleAffiliateStatus);
router.post('/admin/toggle-product', eitherAdminAuth, toggleProductStatus);

export default router;
