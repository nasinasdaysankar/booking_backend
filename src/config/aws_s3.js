// src/config/s3.js
import { S3Client } from "@aws-sdk/client-s3";
import "dotenv/config"; // ✅ FORCE UPDATE ENV

console.log("🔹 AWS S3 Config Loaded");
console.log("🔹 Region:", process.env.AWS_REGION);
console.log("🔹 Bucket:", process.env.AWS_BUCKET_NAME);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export default s3;
