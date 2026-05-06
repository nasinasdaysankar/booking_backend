import { AffiliateProduct } from '../models/index.js';
import sequelize from '../config/db.js';

const products = [
  // Watches
  { title: "Casio Vintage Digital Grey Dial Unisex Watch", category: "electronics", subcategory: "watches", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/3OJ8IoS" },
  { title: "Titan Neo Splash Blue Dial Quartz Watch", category: "electronics", subcategory: "watches", gender: "male", imageUrl: "https://images.unsplash.com/photo-1622434641406-a158123450f9?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/41Vv3m9" },
  { title: "Fossil Grant Chronograph Watch", category: "electronics", subcategory: "watches", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1622434641406-a158123450f9?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4ubMuL0" },
  { title: "Fire-Boltt Ninja Call Pro Plus Smartwatch", category: "electronics", subcategory: "watches", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4vV0D0P" },

  // Mobiles
  { title: "Samsung Galaxy S24 Ultra 5G", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/49cVUxM" },
  { title: "Apple iPhone 15 (128 GB) - Black", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4tO2GSU" },
  { title: "OnePlus 12R (Iron Gray, 256GB)", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/42yfmkZ" },
  
  // Laptops & Audio
  { title: "Apple MacBook Air Laptop M1 chip", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4eet7fM" },
  { title: "Apple MacBook Air 15-inch M3", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4vLOSKa" },
  { title: "Sony WH-1000XM5 Noise Cancelling Headphones", category: "electronics", subcategory: "headphones", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4t5IbjJ" },
  { title: "boAt Rockerz 450 Bluetooth On Ear Headphones", category: "electronics", subcategory: "headphones", gender: "unisex", imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/42A0e6C" },

  // Fashion
  { title: "Puma Men's Dazzler Sneakers", category: "fashion", subcategory: "casual shoes", gender: "male", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/48uUNt7" },
  { title: "Nike Men's Revolution 6 Running Shoes", category: "fashion", subcategory: "casual shoes", gender: "male", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4cC5sEP" },
  { title: "Skechers Women's Go Walk Joy", category: "fashion", subcategory: "casual shoes", gender: "female", imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop", affiliateLink: "https://amzn.to/4cA6T6O" }
];

const seedAffiliates = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connection has been established successfully.');

    // Sync just this model to ensure the table exists (alter to add new columns)
    await AffiliateProduct.sync({ alter: true });
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
