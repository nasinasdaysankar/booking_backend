import { AffiliateProduct } from '../models/index.js';
import sequelize from '../config/db.js';

const products = [
  // Watches
  { title: "Titan Neo Splash Analog Watch", category: "electronics", subcategory: "watches", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71h2K2OQSIL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/41Vv3m9" },
  { title: "Casio Vintage Digital Watch", category: "electronics", subcategory: "watches", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71RbxsgSjRL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3OJ8IoS" },
  { title: "Fossil Grant Chronograph Watch", category: "electronics", subcategory: "watches", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/81WPcUXSbLL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4ubMuL0" },
  { title: "Noise ColorFit Pro Smartwatch", category: "electronics", subcategory: "watches", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/61LkGfsY0QL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4vV0D0P" },

  // Laptops
  { title: "HP 15s Ryzen 5 Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71jG+e7roXL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/48r3AMI" },
  { title: "Lenovo IdeaPad Slim 3", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71TPda7cwUL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4tG9XV4" },
  { title: "ASUS VivoBook 15 i5", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71Q1tPupKjL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4n5rseT" },
  { title: "Dell Inspiron 14 Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71jG+e7roXL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4cBsbkv" },
  { title: "Acer Aspire Lite i5 12th Gen", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71TPda7cwUL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4cPJwoK" },
  { title: "HP 14s Core i3 Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71Q1tPupKjL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4ee0ek2" },
  { title: "Lenovo V15 i5 Business Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71jG+e7roXL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3OrA0jy" },
  { title: "ASUS TUF Gaming F15 Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71TPda7cwUL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/42A0e6C" },
  { title: "MSI Modern 14 i5 Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71Q1tPupKjL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/42xtzP1" },
  { title: "Dell Vostro 3420 Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71jG+e7roXL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3QzIZzS" },
  { title: "HP Pavilion x360 Convertible", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71TPda7cwUL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3P2e7Yd" },
  { title: "Acer Nitro V Gaming Laptop", category: "electronics", subcategory: "laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71Q1tPupKjL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4eeLtxm" },

  // Apple Laptops
  { title: "MacBook Air M2 Chip 13-inch", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71f5Eu5lJSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4tVwZYh" },
  { title: "MacBook Air M1 Chip 256GB", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71f5Eu5lJSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4eet7fM" },
  { title: "MacBook Pro M3 14-inch", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/61lsexTCOhL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/48tCuVg" },
  { title: "MacBook Pro M2 Pro 16-inch", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/61lsexTCOhL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3OLzNI0" },
  { title: "MacBook Air M3 15-inch", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71f5Eu5lJSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4vLOSKa" },
  { title: "MacBook Air M2 Midnight", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71f5Eu5lJSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3P31gF8" },
  { title: "MacBook Pro M3 Pro Chip", category: "electronics", subcategory: "apple laptops", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/61lsexTCOhL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4t5IbjJ" },

  // Mobiles
  { title: "Samsung Galaxy S24 Ultra", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71lnKMHbmSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/49cVUxM" },
  { title: "iPhone 15 128GB", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71657TiFeHL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4tO2GSU" },
  { title: "OnePlus 12R 5G 256GB", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71lnKMHbmSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/42yfmkZ" },
  { title: "Samsung Galaxy A55 5G", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71657TiFeHL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3QAtuHM" },
  { title: "Redmi Note 13 Pro+ 5G", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71lnKMHbmSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4wdSgOr" },
  { title: "Realme GT 6T 5G", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71657TiFeHL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4t0Mr40" },
  { title: "Poco X6 Pro 5G 256GB", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71lnKMHbmSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4eKYa2W" },
  { title: "iQOO Neo 9 Pro 5G", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71657TiFeHL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4eNlltw" },
  { title: "Nothing Phone (2a) 5G", category: "electronics", subcategory: "mobiles", gender: "unisex", imageUrl: "https://m.media-amazon.com/images/I/71lnKMHbmSL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4cPtyL3" },

  // Men Formal Shoes
  { title: "Red Tape Men's Leather Formal Shoes", category: "fashion", subcategory: "formal shoes", gender: "male", imageUrl: "https://m.media-amazon.com/images/I/71A3oNLJqWL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3P6Kvc8" },
  { title: "Bata Men's Oxford Formal Shoes", category: "fashion", subcategory: "formal shoes", gender: "male", imageUrl: "https://m.media-amazon.com/images/I/71A3oNLJqWL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/3OUbPds" },
  { title: "Hush Puppies Men's Derby Shoes", category: "fashion", subcategory: "formal shoes", gender: "male", imageUrl: "https://m.media-amazon.com/images/I/71A3oNLJqWL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4eMq4LV" },

  // Men Casual Shoes
  { title: "Puma Men's Shuffle Sneakers", category: "fashion", subcategory: "casual shoes", gender: "male", imageUrl: "https://m.media-amazon.com/images/I/71fPRJLpIYL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/48uUNt7" },
  { title: "Campus Men's Running Shoes", category: "fashion", subcategory: "casual shoes", gender: "male", imageUrl: "https://m.media-amazon.com/images/I/71fPRJLpIYL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4eKYoHk" },
  { title: "Nike Men's Revolution 6 Shoes", category: "fashion", subcategory: "casual shoes", gender: "male", imageUrl: "https://m.media-amazon.com/images/I/71fPRJLpIYL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4cC5sEP" },

  // Women Formal Shoes
  { title: "Metro Women's Pumps Heels", category: "fashion", subcategory: "formal shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/48MtYkv" },
  { title: "Bata Women's Formal Ballet Flats", category: "fashion", subcategory: "formal shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4ef3s6H" },
  { title: "Clarks Women's Loafers", category: "fashion", subcategory: "formal shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4mYNtvV" },
  { title: "Inc.5 Women's Block Heels", category: "fashion", subcategory: "formal shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4cH1c5C" },
  { title: "Khadim Women's Court Shoes", category: "fashion", subcategory: "formal shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/42A4IKs" },
  { title: "Catwalk Women's Stilettos", category: "fashion", subcategory: "formal shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4t5KsLN" },

  // Women Casual Shoes
  { title: "Puma Women's Sneakers", category: "fashion", subcategory: "casual shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/423Jq7V" },
  { title: "Skechers Women's Walking Shoes", category: "fashion", subcategory: "casual shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4cA6T6O" },
  { title: "Campus Women's Running Shoes", category: "fashion", subcategory: "casual shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/48pZlkx" },
  { title: "Nike Women's Air Max Shoes", category: "fashion", subcategory: "casual shoes", gender: "female", imageUrl: "https://m.media-amazon.com/images/I/61Y5k6tT-aL._AC_UL480_FMwebp_QL65_.jpg", affiliateLink: "https://amzn.to/4dbrGO4" }
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
