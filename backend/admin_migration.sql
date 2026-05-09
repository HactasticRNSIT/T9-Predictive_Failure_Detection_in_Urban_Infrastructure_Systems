-- ============================================================
-- InfraWatch — Admin Panel Migration
-- Run this in your Supabase SQL Editor to add admin columns
-- ============================================================

-- Add status and resolution columns to existing reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution JSONB;

-- Add RLS policies for update/delete (admin operations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public update reports') THEN
    CREATE POLICY "Public update reports" ON reports FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public delete reports') THEN
    CREATE POLICY "Public delete reports" ON reports FOR DELETE USING (true);
  END IF;
END $$;
