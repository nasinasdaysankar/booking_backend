import express from 'express';
import { getRandomAffiliateProduct } from '../controllers/affiliateController.js';

const router = express.Router();

router.get('/random', getRandomAffiliateProduct);

export default router;
