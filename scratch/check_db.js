import { MenuItem } from '../src/models/index.js';
import 'dotenv/config';

async function check() {
  try {
    const items = await MenuItem.findAll({
      where: { isSharedStock: true }
    });
    console.log('Shared Stock Items:', JSON.stringify(items, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
