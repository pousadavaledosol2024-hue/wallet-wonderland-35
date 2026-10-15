CREATE TABLE public.availability_blocks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reservation_id uuid NOT NULL UNIQUE REFERENCES public.reservations(id) ON DELETE CASCADE,
 room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
 check_in date NOT NULL,
 check_out date NOT NULL
);
GRANT SELECT (id, room_id, check_in, check_out) ON public.availability_blocks TO anon, authenticated;
GRANT ALL ON public.availability_blocks TO service_role;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public safe blocked dates" ON public.availability_blocks FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX availability_blocks_room_dates ON public.availability_blocks(room_id, check_in, check_out);
CREATE FUNCTION public.guard_reservation_availability() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.check_out <= NEW.check_in THEN RAISE EXCEPTION 'A saída deve ser após a entrada.' USING ERRCODE = '23514'; END IF;
 PERFORM id FROM public.rooms WHERE id IN (NEW.room_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.room_id ELSE NEW.room_id END) ORDER BY id FOR UPDATE;
 IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE id = NEW.room_id AND user_id = NEW.user_id) THEN RAISE EXCEPTION 'Quarto inválido para esta conta.' USING ERRCODE = '23514'; END IF;
 IF NEW.status IN ('pre_reserva','confirmada','hospedado') AND EXISTS (SELECT 1 FROM public.reservations r WHERE r.room_id = NEW.room_id AND r.id <> NEW.id AND r.status IN ('pre_reserva','confirmada','hospedado') AND r.check_in < NEW.check_out AND r.check_out > NEW.check_in) THEN RAISE EXCEPTION 'Este quarto já está reservado nas datas selecionadas.' USING ERRCODE = '23P01'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_reservation_availability() FROM PUBLIC;
CREATE TRIGGER guard_reservation_availability BEFORE INSERT OR UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_availability();
CREATE FUNCTION public.sync_availability_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN DELETE FROM public.availability_blocks WHERE reservation_id = OLD.id; RETURN OLD; END IF;
 IF NEW.status IN ('pre_reserva','confirmada','hospedado') THEN
 INSERT INTO public.availability_blocks(reservation_id, room_id, check_in, check_out) VALUES (NEW.id, NEW.room_id, NEW.check_in, NEW.check_out) ON CONFLICT(reservation_id) DO UPDATE SET room_id = EXCLUDED.room_id, check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out;
 ELSE DELETE FROM public.availability_blocks WHERE reservation_id = NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_availability_block() FROM PUBLIC;
CREATE TRIGGER sync_availability_block AFTER INSERT OR UPDATE OR DELETE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.sync_availability_block();
INSERT INTO public.availability_blocks(reservation_id, room_id, check_in, check_out) SELECT id, room_id, check_in, check_out FROM public.reservations WHERE status IN ('pre_reserva','confirmada','hospedado');
ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_blocks;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['transactions','orders','ingredients','cash_registers'] LOOP IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t); END IF; END LOOP; END $$;