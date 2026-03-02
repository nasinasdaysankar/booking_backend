-- Migration to add fee visibility toggles to cafeterias table
ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS show_gst BOOLEAN DEFAULT TRUE;
ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS show_platform_fee BOOLEAN DEFAULT TRUE;
ALTER TABLE cafeterias ADD COLUMN IF NOT EXISTS show_commission BOOLEAN DEFAULT TRUE;
