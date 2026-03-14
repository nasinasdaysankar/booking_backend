-- Add is_visible to banners table
ALTER TABLE banners ADD COLUMN is_visible BOOLEAN DEFAULT TRUE;
