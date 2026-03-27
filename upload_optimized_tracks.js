import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "udaya-food-app-images";

async function uploadFile(filePath, key) {
  const fileContent = fs.readFileSync(filePath);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: "image/png",
  });

  try {
    await s3Client.send(command);
    console.log(`✅ Uploaded ${key} to ${BUCKET_NAME}`);
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${key}`;
  } catch (err) {
    console.error(`❌ Error uploading ${key}:`, err);
  }
}

const images = [
  { path: "/Users/nasinaudaysankar/.gemini/antigravity/brain/6a78d04e-2543-4088-ac2a-511b22bb859f/track_preparing_v2_tight_1774637793470.png", key: "assets/track_in_prep_v2.png" },
  { path: "/Users/nasinaudaysankar/.gemini/antigravity/brain/6a78d04e-2543-4088-ac2a-511b22bb859f/track_ready_v2_tight_1774637824585.png", key: "assets/track_ready_v2.png" }
];

(async () => {
  for (const img of images) {
    const url = await uploadFile(img.path, img.key);
    console.log(`URL: ${url}`);
  }
})();
