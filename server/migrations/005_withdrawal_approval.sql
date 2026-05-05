-- Add withdrawal approval workflow fields
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS rejection_note TEXT;

COMMENT ON COLUMN withdrawals.status IS 'pending|approved|rejected';
COMMENT ON COLUMN withdrawals.approved_by IS 'User who approved/rejected the withdrawal';
COMMENT ON COLUMN withdrawals.approved_at IS 'When the withdrawal was approved/rejected';
COMMENT ON COLUMN withdrawals.rejection_note IS 'Note if withdrawal was rejected';

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_shift ON withdrawals(status, shift_id);
