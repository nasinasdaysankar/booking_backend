import fs from "fs";
import path from "path";
import cloudinary from "cloudinary";
import { MenuItem } from "../src/models/index.js";

// 🔧 configure cloudinary
cloudinary.v2.config({
  cloud_name: "YOUR_CLOUD_NAME",
  api_key: "YOUR_API_KEY",
  api_secret: "YOUR_API_SECRET"
});
//updated the new things
// 📁 folder where your images are stored
const folderPath = "/Users/nasinaudaysankar/Downloads/BLENDED & Squeezed Beverages";

async function uploadAndSave() {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);

    // skip non-images
    if (!file.match(/\.(jpg|jpeg|png)$/i)) continue;

    console.log("⏳ Uploading:", file);

    // upload to cloudinary
    const result = await cloudinary.v2.uploader.upload(filePath, {
      folder: "restaurant_images"
    });

    const url = result.secure_url;

    // find menu item by name
    const cleanName = file.replace(/\.(jpg|jpeg|png)$/i, "");

    const item = await MenuItem.findOne({
      where: { name: cleanName }
    });

    if (item) {
      await item.update({ imageUrl: url });
      console.log("✅ Updated:", cleanName);
    } else {
      console.log("❌ No match found:", cleanName);
    }
  }
}

uploadAndSave();
