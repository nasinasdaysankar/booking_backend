import { AffiliateProduct } from '../models/index.js';
import sequelize from '../config/db.js';

const products = [
  // Watches
  { title: "Premium Watch 1", category: "electronics", subcategory: "watches", gender: "unisex", affiliateLink: "https://amzn.to/41Vv3m9" },
  { title: "Premium Watch 2", category: "electronics", subcategory: "watches", gender: "unisex", affiliateLink: "https://amzn.to/3OJ8IoS" },
  { title: "Premium Watch 3", category: "electronics", subcategory: "watches", gender: "unisex", affiliateLink: "https://amzn.to/4ubMuL0" },
  { title: "Premium Watch 4", category: "electronics", subcategory: "watches", gender: "unisex", affiliateLink: "https://amzn.to/4vV0D0P" },

  // Laptops
  { title: "High-Performance Laptop 1", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/48r3AMI" },
  { title: "High-Performance Laptop 2", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/4tG9XV4" },
  { title: "High-Performance Laptop 3", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/4n5rseT" },
  { title: "High-Performance Laptop 4", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/4cBsbkv" },
  { title: "High-Performance Laptop 5", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/4cPJwoK" },
  { title: "High-Performance Laptop 6", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/4ee0ek2" },
  { title: "High-Performance Laptop 7", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/3OrA0jy" },
  { title: "High-Performance Laptop 8", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/42A0e6C" },
  { title: "High-Performance Laptop 9", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/42xtzP1" },
  { title: "High-Performance Laptop 10", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/3QzIZzS" },
  { title: "High-Performance Laptop 11", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/3P2e7Yd" },
  { title: "High-Performance Laptop 12", category: "electronics", subcategory: "laptops", gender: "unisex", affiliateLink: "https://amzn.to/4eeLtxm" },

  // Apple Laptops
  { title: "Apple MacBook 1", category: "electronics", subcategory: "apple laptops", gender: "unisex", affiliateLink: "https://amzn.to/4tVwZYh" },
  { title: "Apple MacBook 2", category: "electronics", subcategory: "apple laptops", gender: "unisex", affiliateLink: "https://amzn.to/4eet7fM" },
  { title: "Apple MacBook 3", category: "electronics", subcategory: "apple laptops", gender: "unisex", affiliateLink: "https://amzn.to/48tCuVg" },
  { title: "Apple MacBook 4", category: "electronics", subcategory: "apple laptops", gender: "unisex", affiliateLink: "https://amzn.to/3OLzNI0" },
  { title: "Apple MacBook 5", category: "electronics", subcategory: "apple laptops", gender: "unisex", affiliateLink: "https://amzn.to/4vLOSKa" },
  { title: "Apple MacBook 6", category: "electronics", subcategory: "apple laptops", gender: "unisex", affiliateLink: "https://amzn.to/3P31gF8" },
  { title: "Apple MacBook 7", category: "electronics", subcategory: "apple laptops", gender: "unisex", affiliateLink: "https://amzn.to/4t5IbjJ" },

  // Mobiles
  { title: "Top Smartphone 1", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/49cVUxM" },
  { title: "Top Smartphone 2", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/4tO2GSU" },
  { title: "Top Smartphone 3", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/42yfmkZ" },
  { title: "Top Smartphone 4", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/3QAtuHM" },
  { title: "Top Smartphone 5", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/4wdSgOr" },
  { title: "Top Smartphone 6", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/4t0Mr40" },
  { title: "Top Smartphone 7", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/4eKYa2W" },
  { title: "Top Smartphone 8", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/4eNlltw" },
  { title: "Top Smartphone 9", category: "electronics", subcategory: "mobiles", gender: "unisex", affiliateLink: "https://amzn.to/4cPtyL3" },

  // Men Formal Shoes
  { title: "Men's Formal Shoes 1", category: "fashion", subcategory: "formal shoes", gender: "male", affiliateLink: "https://amzn.to/3P6Kvc8" },
  { title: "Men's Formal Shoes 2", category: "fashion", subcategory: "formal shoes", gender: "male", affiliateLink: "https://amzn.to/3OUbPds" },
  { title: "Men's Formal Shoes 3", category: "fashion", subcategory: "formal shoes", gender: "male", affiliateLink: "https://amzn.to/4eMq4LV" },

  // Men Casual Shoes
  { title: "Men's Casual Shoes 1", category: "fashion", subcategory: "casual shoes", gender: "male", affiliateLink: "https://amzn.to/48uUNt7" },
  { title: "Men's Casual Shoes 2", category: "fashion", subcategory: "casual shoes", gender: "male", affiliateLink: "https://amzn.to/4eKYoHk" },
  { title: "Men's Casual Shoes 3", category: "fashion", subcategory: "casual shoes", gender: "male", affiliateLink: "https://amzn.to/4cC5sEP" },

  // Women Formal Shoes
  { title: "Women's Formal Shoes 1", category: "fashion", subcategory: "formal shoes", gender: "female", affiliateLink: "https://amzn.to/48MtYkv" },
  { title: "Women's Formal Shoes 2", category: "fashion", subcategory: "formal shoes", gender: "female", affiliateLink: "https://amzn.to/4ef3s6H" },
  { title: "Women's Formal Shoes 3", category: "fashion", subcategory: "formal shoes", gender: "female", affiliateLink: "https://amzn.to/4mYNtvV" },
  { title: "Women's Formal Shoes 4", category: "fashion", subcategory: "formal shoes", gender: "female", affiliateLink: "https://amzn.to/4cH1c5C" },
  { title: "Women's Formal Shoes 5", category: "fashion", subcategory: "formal shoes", gender: "female", affiliateLink: "https://amzn.to/42A4IKs" },
  { title: "Women's Formal Shoes 6", category: "fashion", subcategory: "formal shoes", gender: "female", affiliateLink: "https://amzn.to/4t5KsLN" },

  // Women Casual Shoes
  { title: "Women's Casual Shoes 1", category: "fashion", subcategory: "casual shoes", gender: "female", affiliateLink: "https://amzn.to/423Jq7V" },
  { title: "Women's Casual Shoes 2", category: "fashion", subcategory: "casual shoes", gender: "female", affiliateLink: "https://amzn.to/4cA6T6O" },
  { title: "Women's Casual Shoes 3", category: "fashion", subcategory: "casual shoes", gender: "female", affiliateLink: "https://amzn.to/48pZlkx" },
  { title: "Women's Casual Shoes 4", category: "fashion", subcategory: "casual shoes", gender: "female", affiliateLink: "https://amzn.to/4dbrGO4" }
];

const seedAffiliates = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connection has been established successfully.');

    // Sync just this model to ensure the table exists
    await AffiliateProduct.sync();
    console.log('✅ AffiliateProduct table synced.');

    await AffiliateProduct.destroy({ where: {} });
    console.log('✅ Cleared existing products.');

    await AffiliateProduct.bulkCreate(products);
    console.log('✅ Successfully seeded affiliate products.');

  } catch (error) {
    console.error('❌ Unable to seed affiliate products:', error);
  } finally {
    await sequelize.close();
  }
};

seedAffiliates();
