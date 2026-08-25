-- Hand-written. Drizzle cannot express exclusion constraints or triggers.
-- See planning/reference/schema.ts, `requiredRawSql`, for the source of truth.

-- Geospatial indexes
CREATE INDEX IF NOT EXISTS location_geog_idx
  ON location USING gist (geog);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_area_centre_idx
  ON service_area USING gist (centre_geog);--> statement-breakpoint

-- THE constraint that makes double booking structurally impossible.
-- No application logic, no distributed lock, no race window between
-- checking availability and writing the row.
ALTER TABLE booking ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (status IN ('confirmed', 'in_progress'));--> statement-breakpoint

-- Sanity: a booking cannot end before it starts.
ALTER TABLE booking ADD CONSTRAINT booking_valid_range
  CHECK (ends_at > starts_at);--> statement-breakpoint

-- Bump availability_version on anything that invalidates cached slots.
CREATE OR REPLACE FUNCTION bump_availability_version()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE business
    SET availability_version = availability_version + 1
    WHERE id = COALESCE(NEW.business_id, OLD.business_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER booking_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON booking
  FOR EACH ROW EXECUTE FUNCTION bump_availability_version();--> statement-breakpoint

CREATE TRIGGER blackout_bump_version
  AFTER INSERT OR UPDATE OR DELETE ON blackout
  FOR EACH ROW EXECUTE FUNCTION bump_availability_version();
