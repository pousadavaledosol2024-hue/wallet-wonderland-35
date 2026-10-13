
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 1) Quartos e reservas
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  room_type text NOT NULL DEFAULT 'standard',
  capacity int NOT NULL DEFAULT 2 CHECK (capacity > 0),
  daily_rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','ocupado','manutencao','limpeza')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  guest_name text NOT NULL,
  guest_phone text,
  guest_email text,
  guest_document text,
  guests_count int NOT NULL DEFAULT 1 CHECK (guests_count > 0),
  check_in date NOT NULL,
  check_out date NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('pre_reserva','confirmada','hospedado','finalizada','cancelada')),
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);
CREATE INDEX ON public.reservations (user_id, check_in);
CREATE INDEX ON public.reservations (room_id, check_in, check_out);

-- 2) Insumos, produtos e ficha técnica
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  stock_quantity numeric(12,3) NOT NULL DEFAULT 0,
  min_stock numeric(12,3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  supplier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Lanches',
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  on_menu boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.product_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  UNIQUE (product_id, ingredient_id)
);

-- 4) Movimentações de estoque
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada','saida','ajuste','perda')),
  quantity numeric(12,3) NOT NULL CHECK (quantity <> 0),
  unit_cost numeric(12,2),
  reason text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_movements (ingredient_id, created_at);

CREATE OR REPLACE FUNCTION public.apply_stock_movement() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.ingredients SET stock_quantity = stock_quantity +
    CASE WHEN NEW.movement_type = 'entrada' THEN abs(NEW.quantity)
         WHEN NEW.movement_type = 'ajuste' THEN NEW.quantity
         ELSE -abs(NEW.quantity) END
  WHERE id = NEW.ingredient_id AND user_id = NEW.user_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- 5) Caixa
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  closed_at timestamptz,
  closing_amount numeric(12,2),
  expected_amount numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_open_register_per_user ON public.cash_registers (user_id) WHERE status = 'aberto';

-- 3) Comandas e vendas
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  number serial,
  cash_register_id uuid REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  customer_name text,
  table_label text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','cancelada')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.orders (user_id, opened_at);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total numeric(12,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_order_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.recalc_order_total() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE oid uuid := COALESCE(NEW.order_id, OLD.order_id);
BEGIN
  UPDATE public.orders o SET subtotal = COALESCE((SELECT sum(total) FROM public.order_items WHERE order_id = oid),0),
    total = GREATEST(COALESCE((SELECT sum(total) FROM public.order_items WHERE order_id = oid),0) - o.discount, 0)
  WHERE o.id = oid;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_recalc_order_total AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_order_total();

-- Baixa automática de insumos ao fechar comanda
CREATE OR REPLACE FUNCTION public.consume_stock_on_close() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'fechada' AND OLD.status <> 'fechada' THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
    INSERT INTO public.stock_movements (user_id, ingredient_id, movement_type, quantity, reason, order_id)
    SELECT NEW.user_id, pi.ingredient_id, 'saida', sum(pi.quantity * oi.quantity), 'Venda comanda #' || NEW.number, NEW.id
    FROM public.order_items oi JOIN public.product_ingredients pi ON pi.product_id = oi.product_id
    WHERE oi.order_id = NEW.id GROUP BY pi.ingredient_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_consume_stock_on_close BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.consume_stock_on_close();

CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cash_register_id uuid NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('venda','suprimento','sangria','pagamento','estorno')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text,
  description text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.cash_movements (cash_register_id, created_at);

-- 6) Fluxo de caixa: vincular lançamentos às origens
ALTER TABLE public.transactions
  ADD COLUMN reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN cash_register_id uuid REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  ADD COLUMN business_unit text NOT NULL DEFAULT 'pousada' CHECK (business_unit IN ('pousada','lanchonete','geral'));

-- updated_at triggers
CREATE TRIGGER trg_rooms_upd BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_res_upd BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ing_upd BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prod_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cr_upd BEFORE UPDATE ON public.cash_registers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ord_upd BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grants + RLS (dono vê só os próprios dados)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rooms','reservations','ingredients','products','product_ingredients','stock_movements','cash_registers','orders','order_items','cash_movements'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Owner select" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Owner insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Owner update" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "Owner delete" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;
GRANT USAGE ON SEQUENCE public.orders_number_seq TO authenticated;

-- Relatórios (respeitam RLS do usuário)
CREATE VIEW public.low_stock_alerts WITH (security_invoker = true) AS
SELECT id, user_id, name, unit, stock_quantity, min_stock, (min_stock - stock_quantity) AS shortage
FROM public.ingredients WHERE stock_quantity <= min_stock;

CREATE VIEW public.cash_register_summary WITH (security_invoker = true) AS
SELECT cr.id, cr.user_id, cr.status, cr.opened_at, cr.closed_at, cr.opening_amount, cr.closing_amount,
  COALESCE(sum(cm.amount) FILTER (WHERE cm.movement_type IN ('venda','suprimento')),0) AS entradas,
  COALESCE(sum(cm.amount) FILTER (WHERE cm.movement_type IN ('sangria','pagamento','estorno')),0) AS saidas,
  cr.opening_amount
    + COALESCE(sum(cm.amount) FILTER (WHERE cm.movement_type IN ('venda','suprimento')),0)
    - COALESCE(sum(cm.amount) FILTER (WHERE cm.movement_type IN ('sangria','pagamento','estorno')),0) AS saldo_esperado
FROM public.cash_registers cr LEFT JOIN public.cash_movements cm ON cm.cash_register_id = cr.id
GROUP BY cr.id;

CREATE VIEW public.monthly_cash_flow WITH (security_invoker = true) AS
SELECT user_id, date_trunc('month', due_date)::date AS mes, business_unit,
  sum(amount) FILTER (WHERE type='receita' AND status='pago') AS receitas,
  sum(amount) FILTER (WHERE type='despesa' AND status='pago') AS despesas,
  COALESCE(sum(amount) FILTER (WHERE type='receita' AND status='pago'),0) - COALESCE(sum(amount) FILTER (WHERE type='despesa' AND status='pago'),0) AS saldo,
  sum(amount) FILTER (WHERE type='receita' AND status='pendente') AS a_receber,
  sum(amount) FILTER (WHERE type='despesa' AND status='pendente') AS a_pagar
FROM public.transactions GROUP BY user_id, date_trunc('month', due_date), business_unit;

GRANT SELECT ON public.low_stock_alerts, public.cash_register_summary, public.monthly_cash_flow TO authenticated;
