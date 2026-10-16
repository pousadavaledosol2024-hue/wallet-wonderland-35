ALTER TABLE public.rooms
  ADD COLUMN bed_configuration jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(bed_configuration) = 'array'),
  ADD COLUMN amenities text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN room_position text NOT NULL DEFAULT '',
  ADD COLUMN photo_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN public_description text NOT NULL DEFAULT '',
  ADD COLUMN ical_url text NOT NULL DEFAULT '' CHECK (length(ical_url) <= 2000);
