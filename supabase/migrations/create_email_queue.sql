-- Create email_queue table
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'email',
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create email_dead_letter_queue table
CREATE TABLE IF NOT EXISTS email_dead_letter_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id UUID REFERENCES email_queue(id),
  payload JSONB NOT NULL,
  error TEXT,
  attempts INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_processing ON email_queue(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_email_queue_updated_at();

-- RLS Policies (allow service role to manage queue)
-- Note: Email queue should be managed by service role only
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_dead_letter_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role can manage email queue"
  ON email_queue
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage dead letter queue"
  ON email_dead_letter_queue
  FOR ALL
  USING (auth.role() = 'service_role');

