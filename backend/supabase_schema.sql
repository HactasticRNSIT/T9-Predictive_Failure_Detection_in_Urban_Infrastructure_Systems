-- ============================================================
-- InfraWatch — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Assets Table
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  age DOUBLE PRECISION NOT NULL,
  max_age DOUBLE PRECISION NOT NULL,
  load INTEGER NOT NULL,
  inspection_score INTEGER NOT NULL,
  last_maintenance DOUBLE PRECISION NOT NULL,
  history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  report_id TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  timestamp TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  resolution JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 4. Allow public read access to both tables
CREATE POLICY "Public read assets" ON assets FOR SELECT USING (true);
CREATE POLICY "Public read reports" ON reports FOR SELECT USING (true);

-- 5. Allow public insert to reports (users can submit reports)
CREATE POLICY "Public insert reports" ON reports FOR INSERT WITH CHECK (true);

-- 5b. Allow public update/delete to reports (admin can manage reports)
CREATE POLICY "Public update reports" ON reports FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete reports" ON reports FOR DELETE USING (true);

-- 6. Allow public insert/update to assets (for seeding)
CREATE POLICY "Public manage assets" ON assets FOR ALL USING (true) WITH CHECK (true);

-- 7. Create a storage bucket for report images
-- (Do this in Supabase Dashboard > Storage > New Bucket)
-- Bucket name: report-images
-- Set it to PUBLIC
