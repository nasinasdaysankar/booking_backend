
import { DeliveryPartner } from "../src/models/index.js";

async function resetPartner() {
  try {
    const partnerId = 2; // Mahesh
    const partner = await DeliveryPartner.findByPk(partnerId);
    if (!partner) {
      console.log("❌ Partner not found");
    } else {
      partner.rejectionCount = 0;
      await partner.save();
      console.log(`✅ Reset rejectionCount for ${partner.name}. You can now test the rejection notification!`);
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

resetPartner();
