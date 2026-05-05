-- 003_shift_assignments_time_tracked.sql
-- Make shift assignments time-tracked to support mid-shift reassignments

-- Add time tracking columns
ALTER TABLE shift_assignments
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Drop the old unique constraint that prevented multiple assignments per pump per shift
ALTER TABLE shift_assignments
  DROP CONSTRAINT IF EXISTS shift_assignments_shift_id_pump_id_key;

-- Add a partial unique index: only one ACTIVE assignment per pump per shift
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_assignments_active
  ON shift_assignments (shift_id, pump_id)
  WHERE ended_at IS NULL;

-- Add index for fast lookup of historical assignments by time
CREATE INDEX IF NOT EXISTS idx_shift_assignments_time
  ON shift_assignments (shift_id, pump_id, started_at, ended_at);
