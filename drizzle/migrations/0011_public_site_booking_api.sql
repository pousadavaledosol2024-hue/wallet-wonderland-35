CREATE OR REPLACE FUNCTION public.public_site_snapshot(_from date, _to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _account constant uuid := 'e8aaf4fe-d8fd-4297-b4c0-5ca1952c31d2'; _settings jsonb; _safe jsonb;
BEGIN
 IF _to <= _from OR _to - _from > 366 THEN RAISE EXCEPTION 'Invalid period' USING ERRCODE='22023'; END IF;
 SELECT settings INTO _settings FROM public.site_settings WHERE user_id = _account;
 _settings := coalesce(_settings, '{}'::jsonb);
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO _safe FROM jsonb_each(_settings) WHERE key = ANY(ARRAY['name','slogan','description','logo_url','cover_url','email','phone','whatsapp','address','latitude','longitude','checkin_time','checkout_time','instagram','facebook','airbnb','booking','triplar','holidays','weekend_percent','holiday_percent','extra_adult_discount','child_rate','pet_small','pet_medium','pet_large','cancellation','gallery_urls']);
 RETURN jsonb_build_object('settings',_safe,'rooms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'room_type',r.room_type,'capacity',r.capacity,'daily_rate',r.daily_rate,'public_description',r.public_description,'amenities',r.amenities,'bed_configuration',r.bed_configuration,'room_position',r.room_position,'revision',md5(r.daily_rate::text || _settings::text),'bookable',r.status IN ('disponivel','ocupado'))) FROM public.rooms r WHERE r.user_id=_account),'[]'::jsonb),'blocks',coalesce((SELECT jsonb_agg(jsonb_build_object('room_id',b.room_id,'check_in',b.check_in,'check_out',b.check_out)) FROM public.availability_blocks b JOIN public.rooms r ON r.id=b.room_id WHERE r.user_id=_account AND b.check_in < _to AND b.check_out > _from),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.public_site_snapshot(date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_site_snapshot(date,date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_public_pre_reservation(_id uuid, _room uuid, _from date, _to date, _guests integer, _name text, _phone text, _email text, _notes text, _total numeric, _revision text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _account constant uuid := 'e8aaf4fe-d8fd-4297-b4c0-5ca1952c31d2'; _r public.rooms; _settings jsonb; _existing public.reservations;
BEGIN
 SELECT * INTO _r FROM public.rooms WHERE id=_room AND user_id=_account FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO _existing FROM public.reservations WHERE id=_id;
 IF FOUND THEN
  IF _existing.user_id=_account AND _existing.room_id=_room AND _existing.check_in=_from AND _existing.check_out=_to THEN RETURN _id; END IF;
  RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023';
 END IF;
 IF _from < (now() AT TIME ZONE 'America/Sao_Paulo')::date OR _to<=_from OR _to-_from>366 OR _guests<1 OR _guests>_r.capacity OR _r.status NOT IN ('disponivel','ocupado') OR _total<0 OR _total>10000000 OR length(trim(_name)) NOT BETWEEN 1 AND 200 OR length(_phone) NOT BETWEEN 10 AND 20 OR length(_email)>254 OR length(_notes)>2000 THEN RAISE EXCEPTION 'Invalid reservation' USING ERRCODE='22023'; END IF;
 SELECT coalesce(settings,'{}'::jsonb) INTO _settings FROM public.site_settings WHERE user_id=_account;
 IF md5(_r.daily_rate::text || coalesce(_settings,'{}'::jsonb)::text) IS DISTINCT FROM _revision THEN RAISE EXCEPTION 'Pricing changed' USING ERRCODE='40001'; END IF;
 INSERT INTO public.reservations(id,user_id,room_id,guest_name,guest_phone,guest_email,guests_count,check_in,check_out,total_amount,paid_amount,status,source,notes)
 VALUES(_id,_account,_room,trim(_name),_phone,nullif(_email,''),_guests,_from,_to,_total,0,'pre_reserva','Site público',_notes);
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.create_public_pre_reservation(uuid,uuid,date,date,integer,text,text,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_pre_reservation(uuid,uuid,date,date,integer,text,text,text,text,numeric,text) TO service_role;