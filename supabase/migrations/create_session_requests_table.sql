-- Create session_requests table
CREATE TABLE IF NOT EXISTS session_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('CONSULTATION', 'MEAL_PLAN', 'RESCHEDULE_REQUEST')),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  dietitian_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RESCHEDULE_REQUESTED')),
  event_type_id UUID REFERENCES event_types(id) ON DELETE SET NULL,
  meal_plan_type TEXT,
  price DECIMAL(10, 2),
  currency TEXT DEFAULT 'NGN',
  original_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  requested_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_session_requests_dietitian_id ON session_requests(dietitian_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_client_email ON session_requests(client_email);
CREATE INDEX IF NOT EXISTS idx_session_requests_status ON session_requests(status);
CREATE INDEX IF NOT EXISTS idx_session_requests_event_type_id ON session_requests(event_type_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_original_booking_id ON session_requests(original_booking_id);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_session_requests_updated_at ON session_requests;
CREATE TRIGGER update_session_requests_updated_at BEFORE UPDATE ON session_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE session_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view their own session requests" ON session_requests;
CREATE POLICY "Users can view their own session requests" ON session_requests
  FOR SELECT
  USING (
    auth.uid()::text = client_email OR 
    auth.uid()::text = (SELECT id::text FROM users WHERE email = client_email) OR
    auth.uid()::text = dietitian_id::text
  );

DROP POLICY IF EXISTS "Users can create session requests" ON session_requests;
CREATE POLICY "Users can create session requests" ON session_requests
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = (SELECT id::text FROM users WHERE email = client_email)
  );

DROP POLICY IF EXISTS "Dietitians can update their session requests" ON session_requests;
CREATE POLICY "Dietitians can update their session requests" ON session_requests
  FOR UPDATE
  USING (auth.uid()::text = dietitian_id::text);

-- For now, allow all operations for service role (admin client)
-- This ensures API routes using admin client can work properly
-- You may want to restrict this further based on your needs
DROP POLICY IF EXISTS "Allow all operations on session_requests" ON session_requests;
CREATE POLICY "Allow all operations on session_requests" ON session_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);
