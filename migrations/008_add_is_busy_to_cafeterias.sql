-- Add is_busy to cafeterias table
ALTER TABLE cafeterias ADD COLUMN is_busy BOOLEAN DEFAULT FALSE;
