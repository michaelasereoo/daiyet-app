-- Create function to schedule reminder and feedback jobs when a booking is created
CREATE OR REPLACE FUNCTION schedule_booking_jobs()
RETURNS TRIGGER AS $$
DECLARE
  event_duration INTEGER;
  booking_end_time TIMESTAMPTZ;
BEGIN
  -- Get event type duration
  SELECT length INTO event_duration
  FROM event_types
  WHERE id = NEW.event_type_id;

  -- Calculate booking end time
  booking_end_time := NEW.start_time + (COALESCE(event_duration, 45) || ' minutes')::INTERVAL;

  -- Schedule reminder 24 hours before meeting
  INSERT INTO scheduled_jobs (type, scheduled_for, payload)
  VALUES (
    'meeting_reminder',
    NEW.start_time - INTERVAL '24 hours',
    jsonb_build_object(
      'booking_id', NEW.id,
      'user_id', NEW.user_id,
      'dietitian_id', NEW.dietitian_id,
      'reminder_minutes', 1440
    )
  );

  -- Schedule reminder 1 hour before meeting
  INSERT INTO scheduled_jobs (type, scheduled_for, payload)
  VALUES (
    'meeting_reminder',
    NEW.start_time - INTERVAL '1 hour',
    jsonb_build_object(
      'booking_id', NEW.id,
      'user_id', NEW.user_id,
      'dietitian_id', NEW.dietitian_id,
      'reminder_minutes', 60
    )
  );

  -- Schedule post-session feedback (1 hour after session ends)
  INSERT INTO scheduled_jobs (type, scheduled_for, payload)
  VALUES (
    'post_session_feedback',
    booking_end_time + INTERVAL '1 hour',
    jsonb_build_object(
      'booking_id', NEW.id,
      'user_id', NEW.user_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS schedule_booking_jobs_trigger ON bookings;
CREATE TRIGGER schedule_booking_jobs_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'CONFIRMED' OR NEW.status = 'PENDING')
  EXECUTE FUNCTION schedule_booking_jobs();

