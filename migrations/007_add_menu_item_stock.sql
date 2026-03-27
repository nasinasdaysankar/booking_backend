-- 🛒 ADD STOCK MANAGEMENT COLUMNS TO MENU_ITEMS
ALTER TABLE menu_items 
  ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trackstock BOOLEAN DEFAULT FALSE;

-- Add index for trackstock
CREATE INDEX IF NOT EXISTS idx_menu_items_trackstock ON menu_items(trackstock);
