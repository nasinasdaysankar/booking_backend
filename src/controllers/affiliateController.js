import { AffiliateProduct } from '../models/index.js';
import { sequelize } from '../models/index.js';

export const getRandomAffiliateProduct = async (req, res) => {
  try {
    // Currently picking a completely random product.
    // Future enhancement: Accept user's gender and filter by gender.
    
    const product = await AffiliateProduct.findOne({
      order: [sequelize.random()]
    });

    console.log('Random affiliate product fetched:', product ? product.title : 'NULL');

    if (!product) {
      console.log('Total affiliate products in DB:', await AffiliateProduct.count());
      return res.status(404).json({ success: false, message: 'No affiliate products available' });
    }

    res.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        category: product.category,
        subcategory: product.subcategory,
        imageUrl: product.imageUrl,
        affiliateLink: product.affiliateLink
      }
    });
  } catch (error) {
    console.error('Error fetching random affiliate product:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch affiliate product' });
  }
};
