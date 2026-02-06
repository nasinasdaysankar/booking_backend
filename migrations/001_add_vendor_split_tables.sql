-- ===================================================================
-- DATABASE MIGRATION: Add Vendor and Update Commission Tables
-- ===================================================================

-- 1️⃣ CREATE VENDORS TABLE
CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  "cafeteriaId" INTEGER NOT NULL UNIQUE REFERENCES cafeterias(id) ON DELETE CASCADE,
  "vendorId" VARCHAR(255) NOT NULL UNIQUE,
  "cashfreeVendorId" VARCHAR(255) UNIQUE,
  "vendorName" VARCHAR(255) NOT NULL,
  "vendorEmail" VARCHAR(255) NOT NULL,
  "vendorPhone" VARCHAR(20) NOT NULL,
  "accountHolderName" VARCHAR(255) NOT NULL,
  "accountNumber" VARCHAR(50) NOT NULL,
  "ifscCode" VARCHAR(20) NOT NULL,
  "bankName" VARCHAR(255),
  status VARCHAR(50) DEFAULT 'PENDING_KYC' 
    CHECK (status IN ('PENDING_KYC', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'REJECTED')),
  "kycDocuments" JSONB,
  "activatedAt" TIMESTAMP,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for vendors table
CREATE INDEX IF NOT EXISTS idx_vendors_cafeteria_id ON vendors("cafeteriaId");
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- 2️⃣ UPDATE COMMISSIONS TABLE (Add new columns)
ALTER TABLE commissions 
  ADD COLUMN IF NOT EXISTS "vendorAmount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "splitStatus" VARCHAR(50) DEFAULT 'PENDING' 
    CHECK ("splitStatus" IN ('PENDING', 'SETTLED', 'FAILED')),
  ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "splitId" VARCHAR(255);

-- Update existing commission records with calculated values
UPDATE commissions 
SET 
  "vendorAmount" = COALESCE("vendorAmount", 0),
  "totalAmount" = COALESCE("totalAmount", amount)
WHERE "vendorAmount" IS NULL OR "totalAmount" IS NULL;

-- Create indexes for commissions table
CREATE INDEX IF NOT EXISTS idx_commissions_split_status ON commissions("splitStatus");

-- 3️⃣ ADD COMMENT FOR DOCUMENTATION
COMMENT ON TABLE vendors IS 'Stores Cashfree vendor details for split payment settlement';
COMMENT ON COLUMN commissions."vendorAmount" IS 'Amount sent to vendor/cafeteria owner through Cashfree split';
COMMENT ON COLUMN commissions."splitStatus" IS 'Status of Cashfree split settlement (PENDING/SETTLED/FAILED)';

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Check if vendors table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'vendors'
);

-- Check if commission columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'commissions' 
  AND column_name IN ('vendorAmount', 'totalAmount', 'splitStatus', 'settledAt', 'splitId');

-- Count existing vendors
SELECT COUNT(*) as vendor_count FROM vendors;

-- ===================================================================
-- ROLLBACK SCRIPT (IF NEEDED)
-- ===================================================================

-- To rollback this migration:
/*
DROP TABLE IF EXISTS vendors CASCADE;

ALTER TABLE commissions 
  DROP COLUMN IF EXISTS "vendorAmount",
  DROP COLUMN IF EXISTS "totalAmount",
  DROP COLUMN IF EXISTS "splitStatus",
  DROP COLUMN IF EXISTS "settledAt",
  DROP COLUMN IF EXISTS "splitId";
*/
