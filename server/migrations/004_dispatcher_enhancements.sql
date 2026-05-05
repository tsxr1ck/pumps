-- 004_dispatcher_enhancements.sql
-- Link transactions to withdrawals, support non-cash logging, track unwithdrawn cash

-- Link transactions to the withdrawal that covers them
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS withdrawal_id UUID REFERENCES withdrawals(id);

CREATE INDEX IF NOT EXISTS idx_transactions_withdrawal ON transactions(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift_type ON transactions(shift_id, type);

-- Add a note field to meter_readings for any corrections/annotations
ALTER TABLE meter_readings
  ADD COLUMN IF NOT EXISTS note TEXT;
