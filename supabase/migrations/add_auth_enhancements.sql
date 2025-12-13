-- Add account_status column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'ACTIVE' 
CHECK (account_status IN ('ACTIVE', 'PENDING', 'SUSPENDED', 'DELETED', 'PENDING_VERIFICATION'));

-- Add last_sign_in_at column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- Add email_verified boolean column (if not exists)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Add metadata JSONB column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update existing users to have ACTIVE status if null
UPDATE users 
SET account_status = 'ACTIVE' 
WHERE account_status IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_last_sign_in_at ON users(last_sign_in_at DESC);

-- Add comment to columns
COMMENT ON COLUMN users.account_status IS 'Account status: ACTIVE, PENDING, SUSPENDED, DELETED, PENDING_VERIFICATION';
COMMENT ON COLUMN users.last_sign_in_at IS 'Timestamp of last successful sign-in';
COMMENT ON COLUMN users.email_verified IS 'Whether the email address has been verified';
COMMENT ON COLUMN users.metadata IS 'Additional user metadata stored as JSON';
