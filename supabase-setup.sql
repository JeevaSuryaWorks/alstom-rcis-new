-- ============================================
-- ALSTOM RCIS – Supabase Table Setup
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Reworks table
CREATE TABLE IF NOT EXISTS reworks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  station TEXT NOT NULL,
  defect_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  shift TEXT NOT NULL,
  operator_group TEXT,
  material_batch TEXT,
  suspected_root_cause TEXT,
  severity TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Corrective Actions table
CREATE TABLE IF NOT EXISTS actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  defect_type TEXT NOT NULL,
  description TEXT NOT NULL,
  responsible_person TEXT NOT NULL,
  target_date DATE NOT NULL,
  status TEXT DEFAULT 'Open',
  effectiveness_review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 3. Knowledge Bank table
CREATE TABLE IF NOT EXISTS knowledge (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  corrective_action TEXT NOT NULL,
  before_results TEXT,
  after_results TEXT,
  station TEXT,
  defect_type TEXT,
  date_closed DATE,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Disable RLS (internal tool, no auth needed)
ALTER TABLE reworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge ENABLE ROW LEVEL SECURITY;

-- Allow full access via anon key (internal tool)
CREATE POLICY "Allow all on reworks" ON reworks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on actions" ON actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on knowledge" ON knowledge FOR ALL USING (true) WITH CHECK (true);
