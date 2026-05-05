-- 001_pumps_schema.sql
-- Full schema for the gas station management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role enum
CREATE TYPE user_role AS ENUM ('Manager', 'Cashier', 'Dispatcher');

-- Transaction type enum
CREATE TYPE transaction_type AS ENUM ('Cash', 'Card', 'Credit');

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numeric_id INTEGER UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'Dispatcher',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gas types
CREATE TABLE IF NOT EXISTS gas_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pumps
CREATE TABLE IF NOT EXISTS pumps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number INTEGER UNIQUE NOT NULL,
  name VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hoses (each pump can have multiple hoses, each for a gas type)
CREATE TABLE IF NOT EXISTS hoses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
  gas_type_id UUID NOT NULL REFERENCES gas_types(id) ON DELETE RESTRICT,
  side VARCHAR(10) DEFAULT 'A',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pump_id, gas_type_id, side)
);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  manager_id UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shift assignments (which dispatcher is on which pump)
CREATE TABLE IF NOT EXISTS shift_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
  dispatcher_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, pump_id)
);

-- Meter readings (start and end readings per hose per shift)
CREATE TABLE IF NOT EXISTS meter_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  hose_id UUID NOT NULL REFERENCES hoses(id),
  reading_type VARCHAR(10) NOT NULL CHECK (reading_type IN ('start', 'end')),
  value NUMERIC(12, 2) NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shift_id, hose_id, reading_type)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  pump_id UUID REFERENCES pumps(id),
  type transaction_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  liters NUMERIC(12, 2),
  card_last4 VARCHAR(4),
  credit_category_id UUID,
  note TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  note TEXT,
  recorded_by UUID NOT NULL REFERENCES users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gas prices (append-only history)
CREATE TABLE IF NOT EXISTS gas_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gas_type_id UUID NOT NULL REFERENCES gas_types(id),
  price NUMERIC(10, 2) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  set_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit categories (for corporate credit programs)
CREATE TABLE IF NOT EXISTS credit_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE,
  parent_id UUID REFERENCES credit_categories(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);
CREATE INDEX IF NOT EXISTS idx_shifts_opened_at ON shifts(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_meter_readings_shift ON meter_readings(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_shift ON withdrawals(shift_id);
CREATE INDEX IF NOT EXISTS idx_gas_prices_lookup ON gas_prices(gas_type_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_credit_categories_parent ON credit_categories(parent_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON shifts;
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_categories_updated_at ON credit_categories;
CREATE TRIGGER update_credit_categories_updated_at BEFORE UPDATE ON credit_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
