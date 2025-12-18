-- Normalize session_requests email addresses
-- This trigger ensures all client_email values are stored in lowercase and trimmed

CREATE OR REPLACE FUNCTION normalize_session_request_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.client_email = LOWER(TRIM(NEW.client_email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS normalize_session_request_email_trigger ON session_requests;

-- Create trigger to normalize emails before insert/update
CREATE TRIGGER normalize_session_request_email_trigger
  BEFORE INSERT OR UPDATE ON session_requests
  FOR EACH ROW
  EXECUTE FUNCTION normalize_session_request_email();

-- Fix any existing records with inconsistent email casing
UPDATE session_requests
SET client_email = LOWER(TRIM(client_email))
WHERE client_email != LOWER(TRIM(client_email));

-- Add index for better query performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_session_requests_client_email_normalized 
ON session_requests(LOWER(TRIM(client_email)));

CREATE INDEX IF NOT EXISTS idx_session_requests_client_email_status 
ON session_requests(client_email, status) 
WHERE status IN ('PENDING', 'RESCHEDULE_REQUESTED');

