import { AffiliateProduct } from '../models/index.js';
import { sequelize } from '../models/index.js';

async function test() {
  try {
    const product = await AffiliateProduct.findOne({
      order: [sequelize.random()]
    });
    console.log("Product:", product ? product.toJSON() : "None");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}
test();
