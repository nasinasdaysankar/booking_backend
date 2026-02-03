import { S3Client } from "@aws-sdk/client-s3";

let s3Instance = null;

/**
 * Initialize S3 client with AWS credentials
 * Called lazily when first needed, not on module import
 */
export const initializeS3 = () => {
  if (s3Instance) {
    return s3Instance;
  }

  console.log("🔹 AWS S3 Initializing...");
  console.log("🔹 Region:", process.env.AWS_REGION);
  console.log("🔹 Bucket:", process.env.AWS_S3_BUCKET_NAME);

  // Validate credentials
  if (!process.env.AWS_REGION) {
    console.error("❌ AWS_REGION is missing from .env");
    throw new Error("AWS_REGION is required");
  }

  if (!process.env.AWS_S3_BUCKET_NAME) {
    console.error("❌ AWS_S3_BUCKET_NAME is missing from .env");
    throw new Error("AWS_S3_BUCKET_NAME is required");
  }

  if (!process.env.AWS_ACCESS_KEY_ID) {
    console.error("❌ AWS_ACCESS_KEY_ID is missing from .env");
    throw new Error("AWS_ACCESS_KEY_ID is required");
  }

  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("❌ AWS_SECRET_ACCESS_KEY is missing from .env");
    throw new Error("AWS_SECRET_ACCESS_KEY is required");
  }

  s3Instance = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  console.log("✅ AWS S3 initialized successfully");
  return s3Instance;
};

/**
 * Get S3 client instance
 * Initializes on first call
 */
export const getS3Client = () => {
  if (!s3Instance) {
    initializeS3();
  }
  return s3Instance;
};

export const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME;

export default {
  client: getS3Client(),
  bucket: S3_BUCKET,
};