ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS bed_configuration jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(bed_configuration) = 'array'),
  ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS room_position text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS public_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ical_url text NOT NULL DEFAULT '' CHECK (length(ical_url) <= 2000);