CREATE OR REPLACE FUNCTION public.set_order_item_total() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.total := round(NEW.quantity * NEW.unit_price, 2);
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_order_item_total BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.set_order_item_total();

CREATE OR REPLACE FUNCTION public.stock_on_order_item() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE delta numeric; pid uuid; uid uuid; oid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN delta := NEW.quantity; pid := NEW.product_id; uid := NEW.user_id; oid := NEW.order_id;
  ELSIF TG_OP = 'DELETE' THEN delta := -OLD.quantity; pid := OLD.product_id; uid := OLD.user_id; oid := OLD.order_id;
  ELSE delta := NEW.quantity - OLD.quantity; pid := NEW.product_id; uid := NEW.user_id; oid := NEW.order_id;
  END IF;
  IF pid IS NULL OR delta = 0 THEN RETURN NULL; END IF;
  INSERT INTO public.stock_movements (user_id, ingredient_id, movement_type, quantity, reason, order_id)
  SELECT uid, pi.ingredient_id,
    CASE WHEN delta > 0 THEN 'saida' ELSE 'entrada' END,
    abs(pi.quantity * delta),
    CASE WHEN delta > 0 THEN 'Venda PDV' ELSE 'Estorno PDV' END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE oid END
  FROM public.product_ingredients pi WHERE pi.product_id = pid AND pi.user_id = uid;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_stock_on_order_item AFTER INSERT OR DELETE OR UPDATE OF quantity ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.stock_on_order_item();

CREATE OR REPLACE FUNCTION public.consume_stock_on_close() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'fechada' AND OLD.status <> 'fechada' THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  RETURN NEW;
END; $$;