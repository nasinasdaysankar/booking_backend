import { S3Client } from "@aws-sdk/client-s3";

let s3Instance = null;
let initError = null;

/**
 * Initialize S3 client with AWS credentials
 * Called lazily when first needed, not on module import
 */
export const initializeS3 = () => {
  if (s3Instance) {
    return s3Instance;
  }

  if (initError) {
    throw initError;
  }

  console.log("🔹 AWS S3 Initializing...");
  console.log("🔹 Region:", process.env.AWS_REGION);
  console.log("🔹 Bucket:", process.env.AWS_S3_BUCKET_NAME);

  // Validate credentials - only throw if S3 is actually being used
  if (!process.env.AWS_REGION) {
    initError = new Error("AWS_REGION is required");
    console.error("❌ AWS_REGION is missing from .env");
    throw initError;
  }

  if (!process.env.AWS_S3_BUCKET_NAME) {
    initError = new Error("AWS_S3_BUCKET_NAME is required");
    console.error("❌ AWS_S3_BUCKET_NAME is missing from .env");
    throw initError;
  }

  if (!process.env.AWS_ACCESS_KEY_ID) {
    initError = new Error("AWS_ACCESS_KEY_ID is required");
    console.error("❌ AWS_ACCESS_KEY_ID is missing from .env");
    throw initError;
  }

  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    initError = new Error("AWS_SECRET_ACCESS_KEY is required");
    console.error("❌ AWS_SECRET_ACCESS_KEY is missing from .env");
    throw initError;
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
 * Initializes on first call only
 */
export const getS3Client = () => {
  if (!s3Instance && !initError) {
    return initializeS3();
  }
  if (initError) {
    throw initError;
  }
  return s3Instance;
};

export const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME;

// ✅ Export a safe default object that doesn't call initializeS3()
export default {
  getClient: getS3Client,
  bucket: () => process.env.AWS_S3_BUCKET_NAME,
};