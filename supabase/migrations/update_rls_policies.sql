-- Remove permissive "allow all" policies
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
DROP POLICY IF EXISTS "Allow all operations on event_types" ON event_types;
DROP POLICY IF EXISTS "Allow all operations on bookings" ON bookings;
DROP POLICY IF EXISTS "Allow all operations on payments" ON payments;
DROP POLICY IF EXISTS "Allow all operations on google_oauth_tokens" ON google_oauth_tokens;

-- Users table policies
-- Service role can do anything
CREATE POLICY IF NOT EXISTS "Service role full access to users"
  ON users FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own profile
CREATE POLICY IF NOT EXISTS "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role and account_status)
CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (OLD.role IS NOT DISTINCT FROM NEW.role) AND
    (OLD.account_status IS NOT DISTINCT FROM NEW.account_status)
  );

-- Event types policies
-- Service role can do anything
CREATE POLICY IF NOT EXISTS "Service role full access to event_types"
  ON event_types FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view event types
CREATE POLICY IF NOT EXISTS "Anyone can view active event types"
  ON event_types FOR SELECT
  USING (active = true);

-- Dietitians can manage their own event types
CREATE POLICY IF NOT EXISTS "Dietitians can manage own event types"
  ON event_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'DIETITIAN'
      AND users.id = event_types.user_id
    )
  );

-- Bookings policies
-- Service role can do anything
CREATE POLICY IF NOT EXISTS "Service role full access to bookings"
  ON bookings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own bookings
CREATE POLICY IF NOT EXISTS "Users can view own bookings"
  ON bookings FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = dietitian_id);

-- Users can create bookings
CREATE POLICY IF NOT EXISTS "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Dietitians can update bookings for their events
CREATE POLICY IF NOT EXISTS "Dietitians can update own bookings"
  ON bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM event_types
      WHERE event_types.id = bookings.event_type_id
      AND EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'DIETITIAN'
        AND users.id = event_types.user_id
      )
    )
  );

-- Payments policies
-- Service role can do anything
CREATE POLICY IF NOT EXISTS "Service role full access to payments"
  ON payments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view payments for their bookings
CREATE POLICY IF NOT EXISTS "Users can view own payment records"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = payments.booking_id
      AND (bookings.user_id = auth.uid() OR bookings.dietitian_id = auth.uid())
    )
  );

-- Google OAuth tokens policies
-- Service role can do anything
CREATE POLICY IF NOT EXISTS "Service role full access to google_oauth_tokens"
  ON google_oauth_tokens FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view their own tokens
CREATE POLICY IF NOT EXISTS "Users can view own google tokens"
  ON google_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);
