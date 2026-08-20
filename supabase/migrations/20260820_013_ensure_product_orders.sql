-- The generated Supabase types (src/integrations/supabase/types.ts) do not
-- contain a product_orders table, even though later migrations (e.g.
-- 20260819_009_gl_interconnection.sql, which added gl_settings) clearly did
-- apply successfully. That strongly suggests migration 20260819_004 failed
-- on its own when it was first run and the product_orders table was never
-- actually created in the live database - which would make every query
-- against it fail with "relation \"product_orders\" does not exist",
-- reported by the UI as the generic "Couldn't load product orders."
--
-- This migration is written to be safe to run whether or not any part of
-- 20260819_004 already succeeded: every statement is idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_order_status') THEN
    CREATE TYPE public.product_order_status AS ENUM ('pending', 'approved', 'fulfilled', 'cancelled');
  END IF;
END $$;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS is_for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price  numeric(14,2);

COMMENT ON COLUMN public.inventory_items.is_for_sale IS
  'Whether this item is listed in the member shop for purchase.';
COMMENT ON COLUMN public.inventory_items.sale_price IS
  'Price members pay per unit. Independent of unit_cost (what the club paid).';

CREATE SEQUENCE IF NOT EXISTS public.product_order_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.product_orders (
  id                 bigserial PRIMARY KEY,
  order_no           varchar(20) UNIQUE NOT NULL,
  member_id          bigint NOT NULL REFERENCES public.members(id),
  inventory_item_id  bigint NOT NULL REFERENCES public.inventory_items(id),
  quantity           numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit_price         numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  total_amount       numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  status             public.product_order_status NOT NULL DEFAULT 'pending',
  notes              varchar(200),
  invoice_id         bigint REFERENCES public.invoices(id),
  decided_by         bigint REFERENCES public.members(id),
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_orders_member ON public.product_orders(member_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_status ON public.product_orders(status);
CREATE INDEX IF NOT EXISTS idx_product_orders_item   ON public.product_orders(inventory_item_id);

GRANT SELECT, INSERT, UPDATE ON public.product_orders TO authenticated;
GRANT ALL ON public.product_orders TO service_role;
ALTER TABLE public.product_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view own orders" ON public.product_orders;
CREATE POLICY "Members view own orders" ON public.product_orders
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'treasurer')
  );

DROP POLICY IF EXISTS "Members place own orders" ON public.product_orders;
CREATE POLICY "Members place own orders" ON public.product_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Finance staff manage orders" ON public.product_orders;
CREATE POLICY "Finance staff manage orders" ON public.product_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'treasurer'));

CREATE OR REPLACE FUNCTION public.fn_fulfil_product_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_qty numeric(10,2);
  v_new_qty numeric(10,2);
BEGIN
  IF NEW.status = 'fulfilled' AND OLD.status <> 'fulfilled' THEN
    SELECT quantity INTO v_old_qty FROM public.inventory_items WHERE id = NEW.inventory_item_id FOR UPDATE;
    v_new_qty := v_old_qty - NEW.quantity;

    UPDATE public.inventory_items SET quantity = v_new_qty, updated_at = now()
    WHERE id = NEW.inventory_item_id;

    INSERT INTO public.inventory_movements (
      inventory_item_id, movement_type, quantity_changed, old_quantity, new_quantity,
      notes, recorded_by, movement_date
    ) VALUES (
      NEW.inventory_item_id, 'usage', -NEW.quantity, v_old_qty, v_new_qty,
      'Member purchase, order ' || NEW.order_no, COALESCE(NEW.decided_by, NEW.member_id), CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fulfil_product_order ON public.product_orders;
CREATE TRIGGER trg_fulfil_product_order
AFTER UPDATE ON public.product_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_fulfil_product_order();

GRANT EXECUTE ON FUNCTION public.fn_fulfil_product_order() TO authenticated;

-- Also drop the exact duplicate-migration hazard that made this whole class
-- of bug possible: 20260818082107_772c6b61...sql and 20260818_002_inventory.sql
-- both CREATE TABLE the same inventory tables with no IF NOT EXISTS guard.
-- Whichever one runs second on a fresh database will fail outright and can
-- silently abort the rest of that migration run depending on how migrations
-- are applied. Delete one of the two duplicate files from your repo's
-- supabase/migrations folder (keep only one) so this can't happen again for
-- a future fresh deploy.
