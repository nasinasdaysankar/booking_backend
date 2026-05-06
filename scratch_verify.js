import 'dotenv/config';
import { bulkCreateAffiliateProducts } from './src/controllers/affiliateController.js';

async function test() {
  const req = {
    body: [
      {
        url: 'https://amazon.com/test-product-1',
        category: 'Footwear',
        subcategory: 'Shoes',
        gender: 'male'
      },
      {
        affiliate_link: 'https://amazon.com/test-product-2',
        category: 'Footwear',
        subcategory: 'Slippers',
        gender: 'female',
        title: 'Custom Title'
      }
    ]
  };

  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      console.log('Response Status:', this.statusCode);
      console.log('Response Data:', JSON.stringify(data, null, 2));
    }
  };

  try {
    await bulkCreateAffiliateProducts(req, res);
    if (res.statusCode === 201) {
      console.log('✅ Backend Bulk Create Test Passed');
    } else {
      console.error('❌ Backend Bulk Create Test Failed');
    }
    process.exit(res.statusCode === 201 ? 0 : 1);
  } catch (e) {
    console.error('❌ Test Error:', e);
    process.exit(1);
  }
}

test();
