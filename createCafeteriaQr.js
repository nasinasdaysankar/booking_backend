import crypto from "crypto";
import { CafeteriaQr } from "./src/models/index.js";

const run = async () => {
  try {
    await CafeteriaQr.create({
      cafeteriaId: 1, // MUST match admin.cafeteriaId
      qrToken: crypto.randomBytes(32).toString("hex"),
    });

    console.log("✅ Cafeteria QR created successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating QR:", err);
    process.exit(1);
  }
};

run();
