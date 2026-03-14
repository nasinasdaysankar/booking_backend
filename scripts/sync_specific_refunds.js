import { sequelize, Order, Payment } from "../src/models/index.js";

async function syncRefunds() {
  const orderIds = [20, 21];
  
  for (const orderId of orderIds) {
    try {
      const order = await Order.findByPk(orderId);
      const payment = await Payment.findOne({ where: { orderId: orderId } });
      
      if (order && payment) {
        console.log(`Updating Order ${orderId}...`);
        
        await order.update({ status: "REFUND_SUCCESS" });
        await payment.update({ status: "SUCCESS" }); // 'SUCCESS' is what user app looks for
        
        console.log(`✅ Order ${orderId} synced to REFUND_SUCCESS/SUCCESS`);
      } else {
        console.log(`❌ Order or Payment not found for ID ${orderId}`);
      }
    } catch (err) {
      console.error(`❌ Error syncing order ${orderId}:`, err.message);
    }
  }
  
  process.exit(0);
}

syncRefunds();
