import { S3Client } from "@aws-sdk/client-s3";

let s3Instance = null;

/**
 * Initialize S3 client ONLY when actually needed
 * This is called lazily, NOT on module import
 */
const initializeS3 = () => {
  // If already initialized, return cached instance
  if (s3Instance) {
    return s3Instance;
  }

  console.log("🔹 AWS S3 Initializing (lazy load)...");
  console.log("🔹 Region:", process.env.AWS_REGION);
  console.log("🔹 Bucket:", process.env.AWS_S3_BUCKET_NAME);

  // Validate all required env vars
  const requiredVars = [
    { name: "AWS_REGION", value: process.env.AWS_REGION },
    { name: "AWS_S3_BUCKET_NAME", value: process.env.AWS_S3_BUCKET_NAME },
    { name: "AWS_ACCESS_KEY_ID", value: process.env.AWS_ACCESS_KEY_ID },
    { name: "AWS_SECRET_ACCESS_KEY", value: process.env.AWS_SECRET_ACCESS_KEY },
  ];

  const missing = requiredVars.filter(v => !v.value);

  if (missing.length > 0) {
    const missingNames = missing.map(m => m.name).join(", ");
    console.error(`❌ Missing AWS credentials: ${missingNames}`);
    throw new Error(`AWS credentials missing: ${missingNames}`);
  }

  // All vars present, initialize S3
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
 * Get S3 client - initializes on first call
 */
export const getS3Client = () => {
  return initializeS3();
};

/**
 * Get bucket name
 */
export const getS3Bucket = () => {
  return process.env.AWS_S3_BUCKET_NAME;
};

export default {
  getClient: getS3Client,
  getBucket: getS3Bucket,
};