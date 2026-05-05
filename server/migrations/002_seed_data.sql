-- 002_seed_data.sql
-- Initial seed data for the gas station management system

-- Insert gas types
INSERT INTO gas_types (name, code) VALUES
  ('Regular', 'regular'),
  ('Premium', 'premium')
ON CONFLICT (code) DO NOTHING;

-- Insert pumps (4 pumps, each with A and B sides if needed)
INSERT INTO pumps (number, name) VALUES
  (1, 'Bomba 1'),
  (2, 'Bomba 2'),
  (3, 'Bomba 3'),
  (4, 'Bomba 4')
ON CONFLICT (number) DO NOTHING;

-- Insert hoses: each pump gets one hose per gas type on side 'A'
INSERT INTO hoses (pump_id, gas_type_id, side)
SELECT p.id, gt.id, 'A'
FROM pumps p
CROSS JOIN gas_types gt
ON CONFLICT (pump_id, gas_type_id, side) DO NOTHING;

-- Insert initial Manager user (numeric_id: 1000, PIN: 123456)
-- NOTE: In production, run a script to hash the PIN with bcryptjs
-- For initial setup, you can use the auth route to create users properly.
-- This seed is intentionally minimal; use the API to create the first manager.
