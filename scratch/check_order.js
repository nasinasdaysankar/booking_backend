
import { Order } from "../src/models/index.js";

async function checkOrder() {
  try {
    const orderId = 197;
    const order = await Order.findByPk(orderId);
    if (!order) {
      console.log(`❌ Order ${orderId} not found`);
    } else {
      console.log(`✅ Order ${orderId} found:`);
      console.log(`   Status: ${order.status}`);
      console.log(`   CafeteriaId: ${order.cafeteriaId}`);
      console.log(`   OrderType: ${order.orderType}`);
      console.log(`   BillId: ${order.billId}`);
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

checkOrder();
