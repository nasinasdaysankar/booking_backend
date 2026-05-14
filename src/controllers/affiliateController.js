import { AffiliateProduct, SystemSetting, Order } from '../models/index.js';
import { sequelize } from '../models/index.js';
import { Op } from 'sequelize';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function getRandomAffiliateProduct(req, res) {
  try {
    // Check if affiliate rewards are enabled
    const setting = await SystemSetting.findOne({ where: { key: 'is_affiliate_rewards_enabled' } });
    if (setting && setting.value === 'false') {
      return res.json({ success: true, message: 'Affiliate rewards are currently disabled', product: null });
    }

    const product = await AffiliateProduct.findOne({
      where: { isActive: true },
      order: [sequelize.random()]
    });

    if (!product) {
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

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

export async function getAllAffiliateProducts(req, res) {
  try {
    const products = await AffiliateProduct.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching all affiliate products:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

export async function createAffiliateProduct(req, res) {
  try {
    const { title, category, imageUrl, affiliateLink } = req.body;
    
    if (!title || !category || !affiliateLink) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const product = await AffiliateProduct.create({
      title,
      category,
      imageUrl,
      affiliateLink
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error creating affiliate product:', error);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
};

async function performExtraction(url) {
  try {
    if (!url) return { title: '', imageUrl: '' };
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 8000
    });

    const html = response.data;
    const $ = cheerio.load(html);

    let title = $('meta[property="og:title"]').attr('content') || 
                $('title').text() || 
                $('#productTitle').text().trim();

    let imageUrl = $('meta[property="og:image"]').attr('content') || 
                   $('#landingImage').attr('src') || 
                   $('#landingImage').attr('data-old-hires') ||
                   $('#imgBlkFront').attr('src') ||
                   $('#main-image').attr('src');

    // Handle Amazon's dynamic image JSON
    if (!imageUrl || imageUrl.startsWith('data:image')) {
      const dynamicImageJson = $('#landingImage').attr('data-a-dynamic-image') || 
                               $('.a-dynamic-image').attr('data-a-dynamic-image');
      if (dynamicImageJson) {
        try {
          const images = JSON.parse(dynamicImageJson);
          imageUrl = Object.keys(images)[0]; // Pick the first high-res URL
        } catch (e) {
          console.error('Error parsing dynamic image JSON');
        }
      }
    }

    if (title && title.includes('|')) title = title.split('|')[0].trim();
    if (title && title.includes(': Amazon')) title = title.split(': Amazon')[0].trim();

    return { title: title || '', imageUrl: imageUrl || '' };
  } catch (error) {
    console.error(`Extraction error for ${url}:`, error.message);
    return { title: '', imageUrl: '' };
  }
}

export async function bulkCreateAffiliateProducts(req, res) {
  try {
    const products = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ success: false, message: 'Payload must be an array' });
    }

    const productsToProcess = [];
    
    for (const item of products) {
      // Normalize keys for robustness
      const normalizedItem = {};
      Object.keys(item).forEach(key => {
        normalizedItem[key.toLowerCase().trim()] = item[key];
      });

      const affiliateLink = item.affiliateLink || item.affiliate_link || item.url || item.link || item['link/url'] || normalizedItem['link/url'];
      const category = (item.category || normalizedItem['category'] || '').toString().trim();
      const title = (item.title || normalizedItem['title'] || '').toString().trim();
      const imageUrl = item.imageUrl || item.image_url || item.image || normalizedItem['imageurl'] || normalizedItem['image_url'];

      if (!affiliateLink || !category) {
        continue;
      }

      productsToProcess.push({
        title,
        category,
        imageUrl: imageUrl || '',
        affiliateLink
      });
    }

    if (productsToProcess.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid products found' });
    }

    // Process extraction in small batches to avoid blocks and timeouts
    const batchSize = 3;
    const finalProducts = [];
    
    for (let i = 0; i < productsToProcess.length; i += batchSize) {
      const batch = productsToProcess.slice(i, i + batchSize);
      await Promise.all(batch.map(async (p) => {
        // Only extract if title or image is missing
        if (!p.title || !p.imageUrl) {
          const extracted = await performExtraction(p.affiliateLink);
          if (extracted.title && !p.title) p.title = extracted.title;
          if (extracted.imageUrl && !p.imageUrl) p.imageUrl = extracted.imageUrl;
        }

        // Final fallback for title if extraction also failed
        if (!p.title) {
          p.title = `${p.category}`;
        }

        finalProducts.push(p);
      }));
    }

    const result = await AffiliateProduct.bulkCreate(finalProducts);

    res.status(201).json({ 
      success: true, 
      message: `Successfully imported ${result.length} products`,
      data: result 
    });
  } catch (error) {
    console.error('Error bulk creating affiliate products:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk create products' });
  }
}

export async function deleteAffiliateProduct(req, res) {
  try {
    const { id } = req.params;
    const deleted = await AffiliateProduct.destroy({ where: { id } });
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting affiliate product:', error);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};

export async function extractAffiliateData(req, res) {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const result = await performExtraction(url);
  
  if (result.title || result.imageUrl) {
    res.json({
      success: true,
      data: result
    });
  } else {
    res.json({
      success: true,
      message: 'Extraction failed or was blocked. Please enter details manually.',
      data: { title: '', imageUrl: '' }
    });
  }
}
export async function getAffiliateStatus(req, res) {
  try {
    let setting = await SystemSetting.findOne({ where: { key: 'is_affiliate_rewards_enabled' } });
    
    if (!setting) {
      // Create default if not exists
      setting = await SystemSetting.create({
        key: 'is_affiliate_rewards_enabled',
        value: 'true',
        type: 'BOOLEAN',
        description: 'Master toggle for Amazon affiliate scratch cards',
        group: 'AFFILIATE',
        isPublic: true
      });
    }

    res.json({ success: true, enabled: setting.value === 'true' });
  } catch (error) {
    console.error('Error getting affiliate status:', error);
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
}

export async function toggleAffiliateStatus(req, res) {
  try {
    const { enabled } = req.body;
    
    let [setting] = await SystemSetting.findOrCreate({
      where: { key: 'is_affiliate_rewards_enabled' },
      defaults: {
        value: 'true',
        type: 'BOOLEAN',
        description: 'Master toggle for Amazon affiliate scratch cards',
        group: 'AFFILIATE',
        isPublic: true
      }
    });

    setting.value = enabled ? 'true' : 'false';
    await setting.save();

    res.json({ success: true, enabled: setting.value === 'true' });
  } catch (error) {
    console.error('Error toggling affiliate status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
}

export async function toggleProductStatus(req, res) {
  try {
    const { id, isActive } = req.body;
    
    const product = await AffiliateProduct.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isActive = isActive;
    await product.save();

    res.json({ success: true, message: `Product ${isActive ? 'enabled' : 'disabled'} successfully`, product });
  } catch (error) {
    console.error('Error toggling product status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle product status' });
  }
}

export async function getUserRewards(req, res) {
  try {
    const studentId = req.user.id;

    // Find all orders for this user that have an affiliate reward
    const orders = await Order.findAll({
      where: {
        studentId: studentId,
        affiliateReward: { [Op.ne]: null }
      },
      attributes: ['id', 'billId', 'affiliateReward', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    // We want to check if the reward product is still active
    // The reward object in order has an 'id' field
    const rewards = await Promise.all(orders.map(async (order) => {
      const reward = order.affiliateReward;
      let isAvailable = false;

      if (reward && reward.id) {
        const product = await AffiliateProduct.findByPk(reward.id);
        if (product && product.isActive) {
          isAvailable = true;
        }
      }

      return {
        orderId: order.id,
        billId: order.billId,
        claimedAt: order.createdAt,
        product: reward,
        isAvailable: isAvailable
      };
    }));

    res.json({ success: true, rewards });
  } catch (error) {
    console.error('Error fetching user rewards:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rewards' });
  }
}

export async function claimAffiliateReward(req, res) {
  try {
    const { billId, category } = req.body;

    if (!billId || !category) {
      return res.status(400).json({ success: false, message: 'billId and category are required' });
    }

    // 1. Check if rewards are enabled
    const setting = await SystemSetting.findOne({ where: { key: 'is_affiliate_rewards_enabled' } });
    if (setting && setting.value === 'false') {
      return res.json({ success: false, message: 'Affiliate rewards are currently disabled' });
    }

    // 2. Find the order
    const order = await Order.findOne({ where: { billId } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 3. Pick a random product matching the category
    // Note: We use the display name from the mobile app (e.g. "Tech & Gadgets")
    const product = await AffiliateProduct.findOne({
      where: { category: category, isActive: true },
      order: [sequelize.random()]
    });

    if (!product) {
      // Fallback: If no product in this category, pick ANY random product
      const fallbackProduct = await AffiliateProduct.findOne({
        where: { isActive: true },
        order: [sequelize.random()]
      });
      
      if (!fallbackProduct) {
        return res.status(404).json({ success: false, message: 'No affiliate products available' });
      }
      
      // Update order with fallback
      await order.update({
        affiliateReward: {
          id: fallbackProduct.id,
          title: fallbackProduct.title,
          category: fallbackProduct.category,
          subcategory: fallbackProduct.subcategory,
          imageUrl: fallbackProduct.imageUrl,
          affiliateLink: fallbackProduct.affiliateLink
        }
      });

      return res.json({
        success: true,
        product: order.affiliateReward
      });
    }

    // 4. Update order with the specific category product
    await order.update({
      affiliateReward: {
        id: product.id,
        title: product.title,
        category: product.category,
        subcategory: product.subcategory,
        imageUrl: product.imageUrl,
        affiliateLink: product.affiliateLink
      }
    });

    res.json({
      success: true,
      product: order.affiliateReward
    });

  } catch (error) {
    console.error('Error claiming affiliate reward:', error);
    res.status(500).json({ success: false, message: 'Failed to claim reward' });
  }
}
