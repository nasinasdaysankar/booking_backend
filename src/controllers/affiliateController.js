import { AffiliateProduct } from '../models/index.js';
import { sequelize } from '../models/index.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function getRandomAffiliateProduct(req, res) {
  try {
    const product = await AffiliateProduct.findOne({
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
    const { title, category, subcategory, gender, imageUrl, affiliateLink } = req.body;
    
    if (!title || !category || !subcategory || !affiliateLink) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const product = await AffiliateProduct.create({
      title,
      category,
      subcategory,
      gender: gender || 'unisex',
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
                   $('#imgBlkFront').attr('src') ||
                   $('#main-image').attr('src');

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
      const subcategory = (item.subcategory || normalizedItem['subcategory'] || '').toString().trim();
      const gender = (item.gender || normalizedItem['gender'] || 'unisex').toString().trim().toLowerCase();
      const title = (item.title || normalizedItem['title'] || '').toString().trim();
      const imageUrl = item.imageUrl || item.image_url || item.image || normalizedItem['imageurl'] || normalizedItem['image_url'];

      if (!affiliateLink || !category || !subcategory) {
        continue;
      }

      productsToProcess.push({
        title,
        category,
        subcategory,
        gender,
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
          const capitalizedGender = p.gender.charAt(0).toUpperCase() + p.gender.slice(1);
          const capitalizedSub = p.subcategory.charAt(0).toUpperCase() + p.subcategory.slice(1);
          p.title = `${capitalizedGender} ${capitalizedSub}`;
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
