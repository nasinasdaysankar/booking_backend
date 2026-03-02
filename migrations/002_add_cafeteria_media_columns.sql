-- ===================================================================
-- DATABASE MIGRATION: Add Media Columns to Cafeterias Table
-- ===================================================================

-- 1️⃣ ADD promo_video_url COLUMN
ALTER TABLE cafeterias 
  ADD COLUMN IF NOT EXISTS "promo_video_url" VARCHAR(255);

-- 2️⃣ ADD promo_image_url COLUMN
ALTER TABLE cafeterias 
  ADD COLUMN IF NOT EXISTS "promo_image_url" VARCHAR(255);

-- 3️⃣ VERIFICATION QUERIES
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cafeterias' 
  AND column_name IN ('promo_video_url', 'promo_image_url');
